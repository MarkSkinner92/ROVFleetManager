// scans a range of IP addresses looking for ROVs. See the scan function for usage.

(function() {
    const axios = require('axios');

    // TODO: Need to test with a ROV having multiple IPs
    // TODO: Need to test with an ROV not having an ID, but having multiple IPs. Will it work reliably?
    function scan(scanString, updates, done){
        ips = generateAddressPossibilities(scanString);
        console.log(updates);

        let rovIds = {};

        let numReceived = 0;
        ips.forEach(ip => {
            console.log("fetching:",ip);
            fetchRovId(ip)
            .then(result => {
                numReceived++;
                if(result){
                    if(!rovIds[result]) rovIds[result] = {ips:[ip]};
                    else{
                        rovIds[result].ips.push(ip);
                    }
                    updates(rovIds);
                }

                if(numReceived == ips.length){
                    done();
                }
            });
        });
    }

    // Takes a string such as 192.168.[0-1].[1-255] and returns all the possible IP addresses that it could mean
    function generateAddressPossibilities(ipString) {
        const parts = ipString.split('.');
        if (parts.length !== 4) {
            return [];
        }

        const tree = [];
        const allIPs = [];

        for (const part of parts) {
            const combinations = [];
            const sides = part.split('-');
            if (sides.length === 1) {
                combinations.push(part);
            } else {
                const start = parseInt(sides[0].match(/\d+/)[0]);
                const end = parseInt(sides[1].match(/\d+/)[0]);

                if (start < end) {
                    for (let num = start; num <= end; num++) {
                        combinations.push(num.toString());
                    }
                } else {
                    return [];
                }
            }

            tree.push(combinations);
        }

        for (const a of tree[0]) {
            for (const b of tree[1]) {
                for (const c of tree[2]) {
                    for (const d of tree[3]) {
                        allIPs.push(`${a}.${b}.${c}.${d}`);
                    }
                }
            }
        }

        return allIPs;
    }


    // Sends a post request to each IP asking to run a command to get the cpu serial number
    // If it comes back, then 1. It's an ROV, and 2. It has a unique device ID we can use
    async function fetchRovId(ip){
        const COMMAND = `cat /proc/cpuinfo | grep Serial | awk '{print $3}'`;

        let params = {
            i_know_what_i_am_doing: true,
            command: COMMAND
        }

        try{
            const response = await axios.post(`http://${ip}:9100/v1.0/command/host`, null, {params, timeout:4000})
            const serialNumber = response.data.stdout.replace('\\n','');
            console.log(serialNumber);
            return serialNumber;
        }
        catch (error) {
            return undefined;
        };
    }

    // Exports -----
    module.exports.scan = function(ipString, updates, done) {
        return scan(ipString, updates, done);
    }

}());