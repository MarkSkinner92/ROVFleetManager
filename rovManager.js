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
    class ROV{
        constructor(id, scanResult){
            this.id = id;
            this.ips = scanResult?.ips;
            this.intervals = [];
            this.removed = false;
            this.timer = new Timer(this);

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
            }, 2000));

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
                notes: this.notes,
                timerState: this.timer.state,
                timerText: this.timer.getTimeAsText(),
                thumbnail: this.thumbnail,
                preferredIp: this.preferredIp
            });
        }

        // when response comes in, broadcast to all sockets
        getHeartbeat(){
            console.log(this.id,"asking for heartbeat")
        }
        getUptime(){
            let params = {
                i_know_what_i_am_doing: true,
                command: "uptime -p"
            }
            axios.post(`http://${this.preferredIp}:9100/v1.0/command/host`, null, {params:params}).then(result => {
                let parsedUptime = "U" + result.data.stdout.replace(/^'|'$/g, '').replaceAll('\\n', '').slice(1);
                this.setUptime(parsedUptime);
            }).catch((error) => {
                console.log('get uptime error: ', error)
            })
        }
        getThumbnail(){
            axios.get(`http://${this.preferredIp}/mavlink-camera-manager/thumbnail?source=/dev/video0&quality=75&target_height=150`, {responseType: 'arraybuffer'}).then(result => {
                this.setThumbnail(result.data);
            }).catch((error) => {
                console.log('get name: ', error)
            })
        }
        getName(){
            axios.get(`http://${this.preferredIp}:9111/v1.0/vehicle_name`).then(result => {
                this.setName(result.data);
            }).catch((error) => {
                console.log('get name: ', error)
            })
        }
        getMDNS(){
            axios.get(`http://${this.preferredIp}:9111/v1.0/hostname`).then(result => {
                this.setMdns(result.data);
            }).catch((error) => {
                console.log('get mdns: ', error)
            })
        }
        getNotes(){
            axios.get(`http://${this.preferredIp}:9101/v1.0/get/notes`).then(result => {
                this.setNotes(result.data);
            }).catch((error) => {
                console.log('get notes: ', error)
            })
        }

        setName(data, pushToRov){
            this.name = data;
            this.sendProperty({name: this.name});
            if(pushToRov){
                axios.post(`http://${this.preferredIp}:9111/v1.0/vehicle_name`, null, {params:{
                    name: this.name
                }}).catch(err => {
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
                axios.post(`http://${this.preferredIp}:9111/v1.0/hostname`, null, {params:{
                    hostname: this.mdns
                }}).catch(err => {
                    console.log("Error posting mdns:",err);
                });
            }
        }
        setNotes(data, pushToRov){
            this.notes = data;
            this.sendProperty({notes: this.notes});
            if(pushToRov){
                axios.post(`http://${this.preferredIp}:9101/v1.0/set/notes`,this.notes,{ headers: {'Content-Type': 'application/json'} }).catch(err => {
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
        socket.emit("fullState", constructRovState())
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
            case 'selectIp':
                rov.setpreferredIp(data);
                break;
        }
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