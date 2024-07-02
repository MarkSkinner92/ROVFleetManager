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

        // rovManager.mergeScanResults({
        //     "rov-7smbx81u":{ips:["192.168.1.4","192.168.1.78"]},
        //     'rov-erysu0x2': { ips: [ '192.168.1.185' ] },
        // })
        // rovManager.sendFullStateTo(io);

        scanner.scan(ipRange).then( result => {
            rovManager.mergeScanResults(result);
            // let testResults = {};

            // if(Math.random() > 0.5) testResults["rov-1"] = {ips:["192.168.1.4","192.168.1.78"]};
            // if(Math.random() > 0.5) testResults["rov-2"] = {ips:["192.168.1.5","192.168.1.79"]};
            // if(Math.random() > 0.5) testResults["rov-3"] = {ips:["192.168.1.6","192.168.1.80"]};

            // rovManager.mergeScanResults(testResults)
            rovManager.sendFullStateTo(io);
        });

    })
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server started on http://0.0.0.0:${PORT}`);
});