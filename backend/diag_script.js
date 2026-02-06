const axios = require('axios');
const dns = require('dns');
const { exec } = require('child_process');

const TARGET_HOST = 'member.cmd368.com';
const TARGET_URL = `https://${TARGET_HOST}/Member/BetsView/Data.asmx/GetSportItems`;

function cmd(command) {
    return new Promise(resolve => {
        exec(command, (err, stdout, stderr) => {
            resolve({ stdout, stderr, err });
        });
    });
}

async function checkDns() {
    console.log(`\n[DNS] Resolving ${TARGET_HOST}...`);
    try {
        const addresses = await dns.promises.resolve4(TARGET_HOST);
        console.log(`[DNS] Resolved: ${addresses.join(', ')}`);
    } catch (e) {
        console.log(`[DNS] Failed: ${e.message}`);
    }
}

async function checkPing() {
    console.log(`\n[PING] Pinging ${TARGET_HOST}...`);
    const res = await cmd(`ping -n 3 ${TARGET_HOST}`);
    console.log(res.stdout || res.stderr);
}

async function checkHttp() {
    console.log(`\n[HTTP] Accessing ${TARGET_URL}...`);
    try {
        const res = await axios.post(TARGET_URL, { sportId: 1 }, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });
        console.log(`[HTTP] Status: ${res.status}`);
    } catch (e) {
        if (e.response) {
            console.log(`[HTTP] Reached Server! Status: ${e.response.status}`);
            console.log(`[HTTP] Data Slice: ${JSON.stringify(e.response.data).substring(0, 100)}`);
        } else {
            console.log(`[HTTP] Failed: ${e.code || e.message}`);
        }
    }
}

(async () => {
    await checkDns();
    await checkPing();
    await checkHttp();
})();
