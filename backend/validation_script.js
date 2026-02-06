const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

const PROXY_URL = process.env.ALL_PROXY || 'socks5://127.0.0.1:1080';
const TARGET_URL = 'https://member.cmd368.com/Member/BetsView/Data.asmx/GetSportItems'; // Common endpoint

async function testDirect() {
    console.log('Testing DIRECT connection...');
    try {
        const res = await axios.post(TARGET_URL, { sportId: 1 }, { timeout: 5000 });
        console.log('DIRECT: Success (Unexpected!)', res.status);
    } catch (e) {
        console.log('DIRECT: Failed as expected:', e.code || e.message);
    }
}

async function testProxy() {
    console.log(`Testing PROXY connection (${PROXY_URL})...`);
    const agent = new SocksProxyAgent(PROXY_URL);
    try {
        const res = await axios.post(TARGET_URL, { sportId: 1 }, {
            timeout: 10000,
            httpsAgent: agent
        });
        console.log('PROXY: Success!', res.status);
    } catch (e) {
        if (e.response) {
            console.log('PROXY: Reached Server! Status:', e.response.status);
        } else {
            console.log('PROXY: Failed:', e.code || e.message);
        }
    }
}

(async () => {
    await testDirect();
    await testProxy();
})();
