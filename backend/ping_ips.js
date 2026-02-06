const { exec } = require('child_process');

function ping(ip) {
    return new Promise(resolve => {
        exec(`ping -n 1 ${ip}`, (err, stdout) => {
            resolve({ ip, output: stdout });
        });
    });
}

(async () => {
    console.log('Pinging 182.23.79.195...');
    console.log((await ping('182.23.79.195')).output);

    console.log('Pinging 139.255.196.196...');
    console.log((await ping('139.255.196.196')).output);
})();
