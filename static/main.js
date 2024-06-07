class Timer{
    constructor(startButton, stopButton, textToUpdate){
        this.startTime = 0;
        this.sumOfPausedTime = 0;

        this.state = 'stopped'
        this.startButton = startButton;
        this.stopButton = stopButton;
        this.textToUpdate = textToUpdate;

        this.startButton.addEventListener('click',()=>{
            this.toggleStartPause();
        });
        this.stopButton.addEventListener('click',()=>{
            this.stop();
        });

        console.log(this.start,this.toggleStartPause,this.stop,this.startButton,this.stopButton,this.textToUpdate);

        this.updateInterval;
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
        this.startButton.innerText = 'Pause';
        this.startTime = Date.now();

        this.updateTime();

        this.updateInterval = setInterval(()=>{
            this.updateTime();
        }, 500);
    }
    pause(){
        this.state = 'paused'
        this.startButton.innerText = 'Start';
        this.sumOfPausedTime += Date.now() - this.startTime;
        clearInterval(this.updateInterval);
    }
    stop(){
        this.state = 'stopped'
        this.startButton.innerText = 'Start';
        this.time = 0;
        this.sumOfPausedTime = 0;
        this.updateTime();
        
        clearInterval(this.updateInterval);
    }

    updateTime(){
        let time = this.sumOfPausedTime + (Date.now() - this.startTime);
        if(this.state == 'stopped') time = 0;
        let timeText = new Date(time).toISOString().slice(11, 19);
        this.textToUpdate.innerText = timeText;
    }
}

class ROV{
    constructor(name, ips){
        this.ui = this.createUI();
        this.name = name;
        this.mdns = 'waiting'
        this.ips = ips;
        this.setIPs(ips);
        this.preferredIP = this.ips[0];

        this.timer = new Timer(
            this.ui.querySelector('.timerStartButton'),
            this.ui.querySelector('.timerStopButton'),
            this.ui.querySelector('.timerText')
        );

        setInterval(()=>{
            this.getThumbnail();
        }, 3000);

        this.getNotesRequest();
        this.getMDNSname();
    }
    createUI(){
        parent = document.getElementById('ROVcontainer');
        var clonedNode = document.getElementById('ROV-template').cloneNode(true);
        clonedNode.id = 'ROV-' + this.ip;
        clonedNode.style.display = '';

        this.timerStartButton = clonedNode.querySelector('.timerStartButton');

        this.notesBox = clonedNode.querySelector('.notesBox');
        this.notesBox.addEventListener('change',()=>{
            this.setNotesRequest(this.notesBox.value);
        });

        clonedNode.querySelector('.name').addEventListener('change',()=>{
            let newName = this.name;
            if(newName === ''){
                newName = 'ROV-' + Math.floor(Math.random()*9999+10000)
                this.name = newName;
            }
            this.sendNameChangeRequest(newName);
        });

        clonedNode.querySelector('.mdns').addEventListener('change',()=>{
            let newMDNS = cleanMDNS(this.mdns);
            if(newMDNS === ''){
                newMDNS = cleanMDNS(this.mdns);
                this.mdns = newMDNS;
            }
            this.mdns = newMDNS;
            this.sendMDNSChangeRequest(cleanMDNS(newMDNS));

        });

        clonedNode.querySelector('.openCockpitButton').addEventListener('click',()=>{
            let cockpitURL = `http://${this.preferredIP}/extension/cockpit?full_page=true`;
            window.open(cockpitURL,"_blank");
        });

        this.thumbnail = clonedNode.querySelector('.thumbnail');

        parent.appendChild(clonedNode);
        return clonedNode;
    }

    setIPs(ips){
        let ipHTML = '';
        ips.forEach((ip) => {
            ipHTML += `<a target="_blank" href="http://${ip}">${ip}</a><br>`;
            console.log(ipHTML);
        });
        this.ui.querySelector('.ip-container').innerHTML = ipHTML;
    }

    set name(newName){
        this.ui.querySelector('.name').value = newName;
    }

    get name(){
        return this.ui.querySelector('.name').value;
    }

    set mdns(newMDNS){
        this.ui.querySelector('.mdns').value = newMDNS;
    }

    get mdns(){
        return this.ui.querySelector('.mdns').value;
    }

    sendNameChangeRequest(newName){
        const data = new URLSearchParams();
        data.set('url',`http://${this.preferredIP}:9111/v1.0/vehicle_name?name=${newName}`);

        const queryString = data.toString();

        const finalUrl = `/request?${queryString}`;
        fetch(finalUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
        })
        .then(response => {
            if (response.ok) {
                console.log("Vehicle name changed successfully.");
            } else {
                console.error("Failed to change vehicle name.");
            }
        })
    }

    sendMDNSChangeRequest(newMDNS){
        const data = new URLSearchParams();
        data.set('url',`http://${this.preferredIP}:9111/v1.0/hostname?hostname=${newMDNS}`);

        const queryString = data.toString();

        const finalUrl = `/request?${queryString}`;
        fetch(finalUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
        })
        .then(response => {
            if (response.ok) {
                console.log("Vehicle MDNS changed successfully.");
            } else {
                console.error("Failed to change MDNS.");
            }
        })
    }

    getMDNSname(){
        const data = new URLSearchParams();
        data.set('url',`http://${this.preferredIP}:9111/v1.0/hostname`);
        const queryString = data.toString();

        const finalUrl = `/getFromURL?${queryString}`;
        fetch(finalUrl)
        .then(response => {
            return response.json();
        })
        .then(mdns => {
            this.mdns = mdns;
        });
    }

    getNotesRequest(){
        const data = new URLSearchParams();
        data.set('url',`http://${this.preferredIP}:9101/v1.0/get/notes`);
        const queryString = data.toString();

        fetch(`http://${window.location.hostname}:5000/getFromURL?${queryString}`)
        .then(response => {
            // Check if the response is successful
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            // Parse the JSON in the response
            return response.json();
        })
        .then(data => {
            // Use the data fetched from the API
            if(typeof data != 'object') this.notesBox.value = data;    
        })
    }

    setNotesRequest(notes){
        const data = new URLSearchParams();
        data.set('url',`http://${this.preferredIP}:9101/v1.0/set/notes`);
        data.set('body',notes);
        const queryString = data.toString();

        const finalUrl = `/postWithURL?${queryString}`;
        fetch(finalUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
    }

    getThumbnail(){
        const data = new URLSearchParams();
        data.set('ip',this.preferredIP);
        const queryString = data.toString();
        let thumbnail = this.thumbnail;

        const finalUrl = `/getThumbnail?${queryString}`;
        fetch(finalUrl)
        .then(response => {
            // Check if the response is successful
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            // Parse the JSON in the response
            this.response = response;
            return response.blob();
        })
        .then(function(blob) {
            // Now you have the image data as a blob
            // You can create a URL for the blob and use it in an <img> tag
            var imageUrl = URL.createObjectURL(blob);
            thumbnail.src = imageUrl;
            // console.log(imageUrl);
        })
    }

    destroy(){
        this.ui.remove();
    }
}

function cleanMDNS(mdns){
    return mdns.replace(/[^a-zA-Z0-9]/g, '')
}

let rovList = []

function scan(){
    rovList.forEach((rov)=>{
        rov.destroy();
    });
    rovList = [];

    showSpinner();
    setStatus("Scanning...")
    fetch(`http://${window.location.hostname}:5000/scan`)
    .then(response => {
        // Check if the response is successful
        if (!response.ok) {
            setStatus('Error scanning (internet connection? Server down?)')
            throw new Error('Network response was not ok');
        }
        // Parse the JSON in the response
        return response.json();
    })
    .then(data => {
        // Use the data fetched from the API
        console.log(data);
        let names = Object.keys(data);
        setStatus('Scan complete')
        hideSpinner();
        names.forEach((name)=>{
            newROV = new ROV(name, data[name]);
            rovList.push(newROV);
        })        
    })
    .catch(error => {
        // Handle errors
        console.error('There was a problem with the fetch operation:', error);
    });
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

newROV = new ROV("Example ROV", ["192.168.1.171"]);
rovList.push(newROV);
// newROV = new ROV("Example ROV", ["192.168.1.65","192.168.1.45"]);
// rovList.push(newROV);