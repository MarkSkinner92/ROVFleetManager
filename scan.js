// scans a range of IP addresses looking for ROVs. See the scan function for usage.

(function() {
    const axios = require('axios');

    // TODO: Need to test with a ROV having multiple IPs
    // TODO: Need to test with an ROV not having an ID, but having multiple IPs. Will it work reliably?
    function scan(scanString){
        return new Promise((resolve, reject) => {
            ips = generateAddressPossibilities(scanString);

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
                    }
                    if(numReceived == ips.length){
                        // Scan complete! return results
                        resolve(rovIds);
                    }
                });
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

    // Will return the uniqueID.id property in the bag of holding if it exists.
    // If it doesn't exist, it will create one and return it.
    // If it is not an ROV, or the request excedes the timeout, it will return undefined
    async function fetchRovId(ip){
        try{
            const response = await axios.get(`http://${ip}:9101/v1.0/get/uniqueID`,{timeout: 2000})
            return response.data.id;
        }
        catch (error) {
            if(error.code == "ERR_BAD_REQUEST"){
                // The IP is valid, but a unique ID has not been assigned.
                // We will asign it a unique ID here
                let newId = generateRandomId();
                return await setRovId(ip, newId);
            }
        };
    }

    // Sets it in the bag of holding
    async function setRovId(ip, id){
        try{
            const response = await axios.post(`http://${ip}:9101/v1.0/set/uniqueID`, {id})
            return id;
        }
        catch (error) {
            throw error;
        }
    }

    function generateRandomId() {
        const id = "rov-" + Math.random().toString(36).substring(2, 10); // Generates an 10-character random string
        return id;
    }

    // Exports -----

    module.exports.scan = function(ipString) {
        return scan(ipString);
    }

}());