let scanner = require('./scan.js')
let rovManager = require('./rovManager.js')

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path'); // Node.js path module for file paths

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

rovManager.setBroadcastFunction((topic,data) => {
    io.emit(topic,data);
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'web')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// WebSocket server event handling
io.on('connection', (socket) => {
    console.log("made connection")
    rovManager.sendFullStateTo(socket);

    socket.on("userAction", (id, action, data) => {
        rovManager.handleUserAction(id, action, data);
    })

    socket.on("scan", (ipRange) => {
        io.emit("scanInProgress",socket.id);

        const USE_FAKE_DATA = false;

        if(USE_FAKE_DATA){
            rovManager.mergeScanResults({
                "rov-7smbx81u":{ips:["192.168.1.4","192.168.1.78"], name:"ROV 8"},
                'rov-erysu0x2': { ips: [ '192.168.1.185' ], name:"ROV 1" },
                'rov-erysu0x3': { ips: [ '192.168.1.185' ], name:"ROV 7" },
                'rov-erysu0x4': { ips: [ '192.168.1.185' ], name:"ROV 4" },
                'rov-erysu0x5': { ips: [ '192.168.1.185' ], name:"ROV 2" },
                'rov-erysu0x6': { ips: [ '192.168.1.185' ], name:"ROV 3" },
            })
            rovManager.sendFullStateTo(io);
        }
        else{
            console.log("scanning...");
            scanner.scan(ipRange).then( result => {
                console.log("got scan results");
                rovManager.mergeScanResults(result);
                rovManager.sendFullStateTo(io);
            });
        }

    })
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server started on http://0.0.0.0:${PORT}`);
});