const socket = io(window.location.origin); // Connect to Socket.IO server
const localStorageEnabled = (typeof(Storage) !== "undefined");

class ROV{
    constructor(id, state){
        this.id = id;
        this.removed = false;
        this.initUi();
        this.mergeState(state);
    }

    initUi(){
        parent = document.getElementById('ROVcontainer');
        this.ui = document.getElementById('ROV-template').cloneNode(true);
        this.ui.id = this.id;
        this.ui.style.display = '';

        // Grab references to all elements
        this._name = this.ui.querySelector(".name");
        this._uptime = this.ui.querySelector(".uptime");
        this._powerOff = this.ui.querySelector(".powerOff");
        this._ipSelector = this.ui.querySelector(".ip-selector");
        this._blueOsButton = this.ui.querySelector(".openBlueOSButton");
        this._cockpitButton = this.ui.querySelector(".openCockpitButton");
        this._mdns = this.ui.querySelector(".mdns");
        this._infoBox = this.ui.querySelector(".infoBox");
        this._notesBox = this.ui.querySelector(".notesBox");
        this._battery = this.ui.querySelector(".battery");
        this._temperature = this.ui.querySelector(".temperature");
        this._timerText = this.ui.querySelector(".timerText");
        this._timerStartPause = this.ui.querySelector(".timerStartButton");
        this._timerReset = this.ui.querySelector(".timerStopButton");
        this._thumbnailSplash = this.ui.querySelector(".waitingForThumbnail");
        this._thumbnailImage = this.ui.querySelector(".thumbnail");

        // Set up events
        this._name.addEventListener('change',()=>{
            triggerUserAction(this.id, "name", this._name.value);
            sortROVs();
        });
        this._mdns.addEventListener('change',()=>{
            triggerUserAction(this.id, "mdns", this._mdns.value);
        });
        this._powerOff.addEventListener('click',()=>{
            triggerUserAction(this.id, "powerOff");
        });
        this._blueOsButton.addEventListener('click',()=>{
            let BlueOSURL = `http://${this.preferredIp}`;
            window.open(BlueOSURL,"_blank");
        });
        this._cockpitButton.addEventListener('click',()=>{
            let cockpitURL = `http://${this.preferredIp}/extension/cockpit?full_page=true`;
            window.open(cockpitURL,"_blank");
        });
        this._notesBox.addEventListener('change',()=>{
            triggerUserAction(this.id, "notes", this._notesBox.value);
        });
        this._ipSelector.addEventListener('change',()=>{
            triggerUserAction(this.id, "selectIp", this._ipSelector.value);
        });
        this._timerStartPause.addEventListener('click',()=>{
            triggerUserAction(this.id, "timerStartPause");
        });
        this._timerReset.addEventListener('click',()=>{
            triggerUserAction(this.id, "timerReset");
        });

        this._network = this.ui.querySelector(".networkInformation");
        this._networkChart = this.ui.querySelector(".networkChart");

        this.initChart();

        parent.appendChild(this.ui);
    }

    mergeState(state){
        if(state.hasOwnProperty("name")) this._name.value = state.name;
        if(state.hasOwnProperty("uptime")) this._uptime.innerText = state.uptime;
        if(state.hasOwnProperty("mdns")) this._mdns.value = state.mdns;
        if(state.hasOwnProperty("info")) this._infoBox.value = state.info;
        if(state.hasOwnProperty("notes")) this._notesBox.value = state.notes;
        // if(state.hasOwnProperty("connected")) this.setConnectionStatus(state.connected); //TODO turn back on
        if(state.hasOwnProperty("timerText")) this._timerText.innerText = state.timerText;
        if(state.hasOwnProperty("poweringOff")){
            this.disableForReason("Powering Off...");
        }
        if(state.hasOwnProperty("timerState")){
            switch(state.timerState){
                case "running":
                    this._timerStartPause.innerText = 'Pause';
                    break;
                case "paused":
                case "stopped":
                    this._timerStartPause.innerText = 'Start';
                    break;
            }
        }
        if(state.hasOwnProperty("thumbnail")){
            this._thumbnailImage.src = URL.createObjectURL(new Blob([state.thumbnail], { type: 'application/octet-stream' }));
            this._thumbnailImage.style.display = "";
            this._thumbnailSplash.style.display = "none";
        }
        if(state.hasOwnProperty("ips")) this.mergeNewIps(state.ips, state.preferredIp);
        if(state.hasOwnProperty("pings")){
            this.updateChart(state.pings);
        }
    }

    mergeNewIps(ips, preferredIp){
        let ipHTML = '';
        ips.forEach((ip) => {
            ipHTML += `<option value='${ip}'>${ip}</option>`;
        });
        this._ipSelector.innerHTML = ipHTML;
        if(preferredIp){
            this._ipSelector.value = preferredIp;
            this.preferredIp = preferredIp;
        }
    }

    remove(){
        this.ui.remove();
        this.removed = true;
    }

    setOpacity(opacity){
        this.ui.style.filter = `opacity(${opacity})`;
    }

    setConnectionStatus(statusBool){
        this.ui.querySelector('.connectionStatus').style.display = statusBool ? "none" : "";
        if(statusBool){
            this.setOpacity(1);
        }else{
            this.disableForReason("Connection Lost");
        }
    }
    disableForReason(reason){
        this.ui.querySelector('.connectionStatus').innerText = reason;
        this.ui.querySelector('.connectionStatus').style.display = "";
        this.setOpacity(0.4);
    }

    updateChart(pings){
        let newData = {
            datasets: [
                {
                    label: 'Thumbnail (3s)',
                    borderColor: 'rgb(255, 99, 132)',
                    data: pings['thumbnail'],
                },
                {
                    label: 'Heartbeat (4s)',
                    borderColor: 'rgb(54, 162, 235)',
                    data: pings['heartbeat'],
                }
            ]
        }
        this.networkChart.data = newData;
        this.networkChart.update();
    }

    initChart(){
        let data = {
            datasets: []
        };
        
        const config = {
            type: 'line',
            data: data,
            options: {
                responsive: false,
                maintainAspectRation:false,
                animation: {
                    duration: 0 // general animation time
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Round Trip Request Times'
                    },
                    tooltip:{
                        callbacks:{
                            title: function(context){
                                return parseTime(context[0].raw.x)
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        ticks: {
                            callback: function(value) {
                                return parseTime(value);
                            }
                        },
                    },
                    y: {
                        type: 'linear',
                        ticks: {
                            callback: function(value) {
                                return value + ' ms';
                            }
                        }
                    }
                }
            }
        };
        this.networkChart = new Chart(this._networkChart,config);
    }
}

let rovs = [];

function mergeState(newState){
    let ids = getIdsFromJson(newState);

    rovs.forEach(rov => {
        let state = newState[rov.id];
        if(state){
            rov.mergeState(state)
        }
        else{
            rov.remove()
        }
        ids = ids.filter(e => e !== rov.id)
    })

    rovs = rovs.filter(rov => !rov.removed);

    ids.forEach(id => {
        createNewRov(id,newState[id]);
    });

    updateConnectedCount(rovs.length);
    sortROVs();
}

function triggerUserAction(rovId, action, data){
    socket.emit("userAction",rovId,action,data);
}

function createNewRov(id,state){
    let newRov = new ROV(id,state);
    rovs.push(newRov);
}

function getIdsFromJson(jsonData){
    return Object.keys(jsonData);
}

function getRovById(id){
    for(let i = 0; i < rovs.length; i++){
        let rov = rovs[i];
        if(rov.id == id)
            return rov;
    };
}

function scan(){
    // scan ui adjustments
    showSpinner();
    document.getElementById('scanButton').style.display = 'none';
    setStatus("Scanning...")

    // send message to disable all other scanners
    let ipRange = document.getElementById("ipString").value;
    socket.emit("scan", ipRange);

    // on recieve full state, reset the scan
}

function showSpinner(){
    document.getElementById('spinner').style.display = "";
}
function  hideSpinner(){
    document.getElementById('spinner').style.display = "none";
}
function setStatus(status){
    document.getElementById('statusText').innerText = status;
}

function disableScanning(){
    setStatus("Scan in progress by other user...");
    document.getElementById('scanButton').style.display = 'none';
    document.getElementById('ipString').disabled = true;
}

function enableScanning(){
    document.getElementById('scanButton').style.display = "";
    document.getElementById('ipString').disabled = false;
}

function powerOffAll(){
    for(let i = 0; i < rovs.length; i++){
        if(rovs[i]){
            rovs[i].disableForReason("Connection Lost");
            console.log(rovs[i].id,"powering off");
            triggerUserAction(rovs[i].id, "powerOff");
        }
    }
}

function updateConnectedCount(count){
    document.getElementById('num-connected').innerText = `${count} connected`
}

function sortROVs(){
    console.log(rovs);
    rovs = rovs.sort((a, b) => {
        if (a._name.value < b._name.value) return -1;
        if (a._name.value > b._name.value) return 1;
        return 0;
    });
    rovs.forEach((rov, index) => {
        rov.ui.style.order = index+1;
    })
}

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('fullState', (state) => {
    console.log("got full state",state);

    // Assume that full state is from the last scan, therefore the scan is complete
    setStatus("Ready for scan");
    document.getElementById('scanButton').style.display = 'unset';
    hideSpinner();
    enableScanning();

    mergeState(state);
});

socket.on('partialState', (partialState) => {
    console.log("got partial state", partialState);
    let rov = getRovById(partialState.id)
    if(rov) rov.mergeState(partialState);
});

socket.on('scanInProgress', (idOfScanRequestor) => {
    if(socket.id == idOfScanRequestor) return;
    disableScanning();
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Local Storage to make IP string faster
document.getElementById("ipString").addEventListener('change',result => {
    if(localStorageEnabled) localStorage.setItem('ipString',document.getElementById("ipString").value);
});

if(localStorageEnabled) document.getElementById("ipString").value = localStorage.getItem("ipString");

function parseTime(value){
    return formatTimestamp(value);
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}