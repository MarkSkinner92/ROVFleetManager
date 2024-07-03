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

        parent.appendChild(this.ui);
    }

    mergeState(state){
        if(state.hasOwnProperty("name")) this._name.value = state.name;
        if(state.hasOwnProperty("uptime")) this._uptime.innerText = state.uptime;
        if(state.hasOwnProperty("mdns")) this._mdns.value = state.mdns;
        if(state.hasOwnProperty("notes")) this._notesBox.value = state.notes;
        if(state.hasOwnProperty("connected")) this.setConnectionStatus(state.connected);
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