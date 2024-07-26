// Manages the ROVs as a whole

(function() {
    const axios = require('axios');
    class Timer{
        constructor(rov){
            this.startTime = 0;
            this.sumOfPausedTime = 0;
            this.state = 'stopped' 
            this.updateInterval;
            this.rov = rov;
        }
        toggleStartPause(){
            if(this.state == 'running'){
                this.pause();
            }else{
                this.start();
            }
        }
        start(){
            this.state = 'running'
            this.rov.sendProperty({timerState: this.state});
            this.startTime = Date.now();
    
            this.updateTime();
    
            this.updateInterval = setInterval(()=>{
                this.updateTime();
            }, 1000);
        }
        pause(){
            this.state = 'paused'
            this.rov.sendProperty({timerState: this.state});
            this.sumOfPausedTime += Date.now() - this.startTime;
            clearInterval(this.updateInterval);
        }
        stop(){
            this.state = 'stopped'
            this.rov.sendProperty({timerState: this.state});
            this.time = 0;
            this.sumOfPausedTime = 0;
            this.updateTime();
            
            clearInterval(this.updateInterval);
        }
    
        getTimeAsText(){
            let time = this.sumOfPausedTime + (Date.now() - this.startTime);
            if(this.state == 'stopped') time = 0;
            let timeText = new Date(time).toISOString().slice(11, 19);
            return timeText;
        }

        updateTime(){
            let timeText = this.getTimeAsText();
            this.rov.sendProperty({timerText: timeText});
        }
    }

    class TimeTracker{
        constructor(rov){
            this.table = {};
            this.rov = rov;
            setInterval(()=>{
                console.log(this.getAverages());
            }, 2000);

            this.goodAverages = {
                name: 40,
                thumbnail: 600,
                mdns: 40,
                notes: 40,
                uptime: 650,
                info: 40,
                heartbeat: 60
            }
        }
        makeNewRecord(){
            return {
                name:"",
                start:0,
                end:0,
                duration:0
            }
        }
        start(name){
            if(!this.table[name]) this.table[name] = [];

            this.table[name].push({
                start:Date.now(),
                end:0,
                duration:0
            });
        }

        stop(name){
            let record = this.table[name][this.table[name].length-1];
            //give 10 minutes of data for each name
            if(record.start - this.table[name][0].start > 10*60*1000){
                this.table[name].shift()
            }
            record.end = Date.now();
            record.duration = record.end - record.start;
            console.log("TimeTracker:",name,record.duration)

            this.rov.sendProperty({pings: this.condense()});
        }

        condense(){
            //y is duration, x is stoptime
            let data = {};
            data['thumbnail'] = [];
            data['heartbeat'] = [];
            data['info'] = [];
            data['uptime'] = [];

            if(this.table['thumbnail']) this.table['thumbnail'].forEach(record => {
                if(record.duration){
                    data['thumbnail'].push({
                        x:record.end,
                        y:record.duration
                    })
                }
            });
            if(this.table['heartbeat']) this.table['heartbeat'].forEach(record => {
                if(record.duration){
                    data['heartbeat'].push({
                        x:record.end,
                        y:record.duration
                    })
                }
            });
            if(this.table['info']) this.table['info'].forEach(record => {
                if(record.duration){
                    data['info'].push({
                        x:record.end,
                        y:record.duration
                    })
                }
            });
            if(this.table['uptime']) this.table['uptime'].forEach(record => {
                if(record.duration){
                    data['uptime'].push({
                        x:record.end,
                        y:record.duration
                    })
                }
            });
            

            return data;
        }

        getAverages(){
            let averages = {};
            let names = Object.keys(this.table);
            for(let i = 0; i < names.length; i++){
                averages[names[i]] = this.findAverageOfRecord(this.table[names[i]]);
            }
            return averages;
        }
        findAverageOfRecord(records){
            let average = 0;
            for(let i = 0; i < records.length; i++){
                let record = records[i];
                average += record.duration;
            }
            // console.log(average,records.length)
            average /= records.length;
            return average;
        }

        compareAverages(){
            let averages = this.getAverages();
            let keys = Object.keys(this.goodAverages);
            for(let i = 0; i < keys.length; i++){
                averages[keys[i]]
            }
        }
    }

    class ROV{
        constructor(id, scanResult){
            this.id = id;
            this.ips = scanResult?.ips;
            this.intervals = [];
            this.removed = false;
            this.timer = new Timer(this);
            this.timeTracker = new TimeTracker(this);
            this.name = scanResult?.name;

            if(this.ips) if(this.ips.length > 0) this.setpreferredIp(this.ips[0])
            
            this.startIntervals();
            this.initRequests();
        }

        remove(){
            this.clearAllIntervals();
            this.removed = true;
        }

        restartIntervals(){
            this.clearAllIntervals();
            this.startIntervals();
        }

        startIntervals(){
            // Start heartbeat + thumbnail
            this.intervals.push(setInterval(()=>{
                this.getHeartbeat();
                this.getInfo();
            }, 4000));

            this.intervals.push(setInterval(()=>{
                this.getUptime();
            }, 30*1000));

            this.intervals.push(setInterval(()=>{
                this.getThumbnail();
            }, 3000));
        }

        clearAllIntervals(){
            this.intervals.forEach(intervalId => {
                clearInterval(intervalId);
            })
        }

        initRequests(){
            this.getName();
            this.getThumbnail();
            this.getMDNS();
            this.getNotes();
            this.getUptime();
            this.getInfo();
        }

        mergeNewIps(newIps){
            this.ips = newIps;
            if(!this.ips.includes(this.preferredIp)){
                this.setpreferredIp(this.ips[0]);
            }
        }

        constructState(){
            return({
                id: this.id,
                ips: this.ips,
                name: this.name,
                uptime: this.uptime,
                mdns: this.mdns,
                info: this.info,
                notes: this.notes,
                timerState: this.timer.state,
                timerText: this.timer.getTimeAsText(),
                thumbnail: this.thumbnail,
                preferredIp: this.preferredIp,
                poweringOff: this.poweringOff
            });
        }

        // when response comes in, broadcast to all sockets
        getHeartbeat(){
            this.timeTracker.start('heartbeat');
            axios.get(`http://${this.preferredIp}/commander`,{timeout: 4000}).then(result => {
                this.timeTracker.stop('heartbeat');
                if(!this.poweringOff) this.sendProperty({connected: true});
            }).catch((error) => {
                this.sendProperty({connected: false});
            })
        }
        getUptime(){
            let params = {
                i_know_what_i_am_doing: true,
                command: "uptime -p"
            }
            this.timeTracker.start('uptime');
            axios.post(`http://${this.preferredIp}:9100/v1.0/command/host`, null, {params:params}).then(result => {
                this.timeTracker.stop('uptime');
                let parsedUptime = "U" + result.data.stdout.replace(/^'|'$/g, '').replaceAll('\\n', '').slice(1);
                this.setUptime(parsedUptime);
            }).catch((error) => {
                console.log('get uptime error: ', error)
            })
        }
        getThumbnail(){
            this.timeTracker.start('thumbnail');
            axios.get(`http://${this.preferredIp}/mavlink-camera-manager/thumbnail?source=/dev/video0&quality=75&target_height=150`, {responseType: 'arraybuffer'}).then(result => {
                this.timeTracker.stop('thumbnail');
                this.setThumbnail(result.data);
            }).catch((error) => {
                console.log('get name: ', error)
            })
        }
        getName(){
            this.timeTracker.start('name');
            axios.get(`http://${this.preferredIp}:9111/v1.0/vehicle_name`).then(result => {
                this.timeTracker.stop('name');
                this.setName(result.data);
            }).catch((error) => {
                console.log('get name: ', error)
            })
        }
        getMDNS(){
            this.timeTracker.start('mdns');
            axios.get(`http://${this.preferredIp}:9111/v1.0/hostname`).then(result => {
                this.timeTracker.stop('mdns');
                this.setMdns(result.data);
            }).catch((error) => {
                console.log('get mdns: ', error)
            })
        }
        getInfo(){
            this.timeTracker.start('info');
            axios.get(`http://${this.preferredIp}:9101/v1.0/get/fleetManager`).then(result => {
                this.timeTracker.stop('info');
                let object = result.data;
                let info = "";
                getKeyValuePairs(object).forEach(pair => {
                    info += `${pair.key}: ${JSON.stringify(pair.value)}\n`
                })
                this.setInfo(info);
            }).catch((error) => {
                console.log('get info: ', error)
            })
        }
        getNotes(){
            this.timeTracker.start('notes');
            axios.get(`http://${this.preferredIp}:9101/v1.0/get/notes`).then(result => {
                this.timeTracker.stop('notes');
                this.setNotes(result.data);
            }).catch((error) => {
                console.log('get notes: ', error)
            })
        }

        setName(data, pushToRov){
            this.name = data;
            this.sendProperty({name: this.name});
            if(pushToRov){
                this.timeTracker.start('name');
                axios.post(`http://${this.preferredIp}:9111/v1.0/vehicle_name`, null, {params:{
                    name: this.name
                }}).then(result => {
                    this.timeTracker.stop('name');
                }).catch(err => {
                    console.log("Error posting name:",err);
                });
            }
        }
        setUptime(data){
            this.uptime = data;
            this.sendProperty({uptime: this.uptime});
        }
        setMdns(data, pushToRov){
            this.mdns = data;
            this.sendProperty({mdns: this.mdns});
            if(pushToRov){
                this.timeTracker.start('mdns');
                axios.post(`http://${this.preferredIp}:9111/v1.0/hostname`, null, {params:{
                    hostname: this.mdns
                }}).then(resp => {
                    this.timeTracker.stop('mdns');
                }).catch(err => {
                    console.log("Error posting mdns:",err);
                });
            }
        }
        powerOff(){
            this.poweringOff = true;
            this.sendProperty({poweringOff: true});
            axios.post(`http://${this.preferredIp}:9100/v1.0/shutdown`, null, {params:{
                i_know_what_i_am_doing: true,
                "shutdown_type": "poweroff"
            }}).catch(err => {
                console.log("Error shutting down:",err);
            });
        }
        setInfo(data){
            this.info = data;
            this.sendProperty({info: this.info});
        }
        startSpeedTest(){
            axios.get(`http://${this.preferredIp}:5000/speedtest`);
            console.log("speed test request sent")
        }
        setNotes(data, pushToRov){
            this.notes = data;
            this.sendProperty({notes: this.notes});
            if(pushToRov){
                this.timeTracker.start('notes');
                axios.post(`http://${this.preferredIp}:9101/v1.0/set/notes`,this.notes,{ headers: {'Content-Type': 'application/json'} }).then(value => {
                    this.timeTracker.stop('notes');
                }).catch(err => {
                    console.log("Error posting notes:",err);
                });
            }
        }
        setpreferredIp(data){
            this.preferredIp = data;
            this.sendProperty({preferredIp: this.preferredIp, ips: this.ips});
        }
        setThumbnail(url){
            this.thumbnail = url;
            this.sendProperty({thumbnail: this.thumbnail});
        }
        sendProperty(data){
            let state = data;
            state.id = this.id;
            sendStateFragment(state);
        }
    }

    let rovs = [];

    // Look through the scan results and update the state. Remove disconnected ROVs, merge new IPs, and add new ROVs.
    function mergeScanResults(scanResults){
        let ids = getIdsFromJson(scanResults);

        rovs.forEach(rov => {
            let scanResult = scanResults[rov.id];
            if(scanResult){
                rov.mergeNewIps(scanResult.ips)
            }
            else{
                rov.remove()
            }
            ids = ids.filter(e => e !== rov.id)
        })

        rovs = rovs.filter(rov => !rov.removed);

        ids.forEach(id => {
            createNewRov(id,scanResults[id]);
        });
    }

    function getIdsFromJson(jsonData){
        return Object.keys(jsonData);
    }

    function createNewRov(id,scanResult){
        let newRov = new ROV(id,scanResult);
        rovs.push(newRov);
    }

    function constructRovState(){
        let state = {};
        rovs.forEach(rov => {
            state[rov.id] = rov.constructState();
        });
        return state;
    }

    let broadcast = function(topic, data){
        console.log("sending",data,"on topic",topic);
    }

    function setBroadcastFunction(broadcastFunction){
        broadcast = broadcastFunction;
    }

    function sendFullStateTo(socket){
        socket.emit("fullState", constructRovState());
    }

    function sendStateFragment(partialState){
        broadcast("partialState", partialState);
    }

    function getRovById(id){
        for(let i = 0; i < rovs.length; i++){
            let rov = rovs[i];
            if(rov.id == id)
                return rov;
        };
    }

    // Like changing the name, adding a note, or shutting down
    function handleUserAction(rovId, action, data){
        let rov = getRovById(rovId);
        if(!rov){
            console.log("user acted on a non-existant ROV");
            return;
        }
        switch(action){
            case 'name':
                rov.setName(data, true);
                break;
            case 'mdns':
                rov.setMdns(data, true);
                break;
            case 'notes':
                rov.setNotes(data, true);
                break;
            case 'timerStartPause':
                rov.timer.toggleStartPause();
                break;
            case 'timerReset':
                rov.timer.stop();
                break;
            case 'powerOff':
                rov.powerOff();
                break;
            case 'selectIp':
                rov.setpreferredIp(data);
                break;
            case 'startSpeedTest':
                rov.startSpeedTest();
                break;
        }
    }

    function getKeyValuePairs(obj, parentKey = '') {
        let result = [];
    
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                const newKey = parentKey ? `${parentKey}.${key}` : key;
    
                if (typeof value === 'object' && value !== null) {
                    // Recursively retrieve pairs from nested objects
                    result = result.concat(getKeyValuePairs(value, newKey));
                } else {
                    // Push the key-value pair to the result array
                    result.push({ key: newKey, value: value });
                }
            }
        }
    
        return result;
    }

    module.exports.setBroadcastFunction = function(broadcastFunction){
        return setBroadcastFunction(broadcastFunction)
    }

    module.exports.mergeScanResults = function(scanResults){
        return mergeScanResults(scanResults)
    }

    module.exports.sendFullStateTo = function(sendMethod){
        return sendFullStateTo(sendMethod)
    }

    module.exports.handleUserAction = function(rovId, action, data){
        return handleUserAction(rovId, action, data);
    }

}())