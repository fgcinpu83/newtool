
const axios = require('axios');

async function testSite(name, url, cookies, origin) {
    console.log(`TESTING: ${name} (${url})`);
    try {
        const res = await axios.post(url, { sportId: 1, marketId: 0 }, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'Cookie': cookies,
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'X-Srv': 'WS-187',
                'Origin': origin || 'https://qq188pjm.com',
                'Referer': origin || 'https://qq188pjm.com'
            },
            timeout: 10000
        });
        console.log(`[${name}] STATUS:`, res.status);
        console.log(`[${name}] DATA (first 500 chars):`, JSON.stringify(res.data).substring(0, 500));
        return true;
    } catch (e) {
        console.error(`[${name}] ERROR:`, e.code || e.message);
        if (e.response) {
            console.error(`[${name}] RESPONSE STATUS:`, e.response.status);
            // console.error(`[${name}] RESPONSE DATA:`, e.response.data);
        }
        return false;
    }
}

async function run() {
    const cookies = 'language=en-US; acctInfo={\"sessionId\":\"b2a8d5e24fed4826a3c21fbcd7a775f7\",\"loginId\":\"Gt1888\",\"currency\":\"IDR\",\"balance\":4.79,\"bonus\":0,\"isReferralAccount\":true,\"isAffiliateAccount\":false,\"token\":\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1lIjoiMzM3Mjk0QDAxMiIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWVpZGVudGlmaWVyIjoiMzM3Mjk0QDAxMiIsIlRva2VuIjoiYjJhOGQ1ZTI0ZmVkNDgyNmEzYzIxZmJjZDdhNzc1ZjciLCJNZXJjaGFudElkIjoiMDEyIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiTWVtYmVyIiwianRpIjoiNjIyMmY3Y2EtMzBkZC00NGIwLWI2Y2EtYzdhYWI3ZWU1NTZkIiwiZXhwIjoxNzY4MzUxMTI5LCJpc3MiOiJ3d3cuaW5kb2Nhc2guY29tIiwiYXVkIjoiSWRlbnRpdHlVc2VyIn0.2M277q8vRxCvhvZTBem5_ZTECt6azWDyT2dzPkr5LjI\",\"refreshToken\":\"50E07F27AC1F50198E10840331718B5C4CC7F86286C6AD9B9415BCB43211337F72C0B4090733E818\",\"expiryUtcDate\":\"2026-01-14T00:38:49.179621Z\"}; sessionId=b2a8d5e24fed4826a3c21fbcd7a775f7; token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1lIjoiMzM3Mjk0QDAxMiIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWVpZGVudGlmaWVyIjoiMzM3Mjk0QDAxMiIsIlRva2VuIjoiYjJhOGQ1ZTI0ZmVkNDgyNmEzYzIxZmJjZDdhNzc1ZjciLCJNZXJjaGFudElkIjoiMDEyIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiTWVtYmVyIiwianRpIjoiNjIyMmY3Y2EtMzBkZC00NGIwLWI2Y2EtYzdhYWI3ZWU1NTZkIiwiZXhwIjoxNzY4MzUxMTI5LCJpc3MiOiJ3d3cuaW5kb2Nhc2guY29tIiwiYXVkIjoiSWRlbnRpdHlVc2VyIn0.2M277q8vRxCvhvZTBem5_ZTECt6azWDyT2dzPkr5LjI; refreshToken=50E07F27AC1F50198E10840331718B5C4CC7F86286C6AD9B9415BCB43211337F72C0B4090733E818; srv=1b1db526758f6d57b2483fcf31d760c7; isShowMaintenanceInGame=';
    const fullOrigin = 'https://qq188pjm.com/Games?id=ICL&gurl=https:%2F%2Fb8d6ob.aro0061.com%2FDepositProcessLogin%3Ftoken%3D06nldg42YE6q7uCA9OHvkA%26lang%3Den%26OType%3D2&gameCode=null&device=W&RealMoney=true';
    const baseUrl = 'https://b8d6ob.aro0061.com/(S(Tesqedixc489865623114dbcbfc207be22566a43))/';

    await testSite('ARO-LIVE-PROBE', baseUrl + 'Member/BetsView/Data.asmx/GetSportItems', cookies, fullOrigin);
}

run();
