const http = require('http');

// AFB88 Test Data - Format 1 (HomePrice/AwayPrice)
const afbTestData1 = {
  "error": "",
  "js": "if(NotGuest===0){window.location.reload();} NotGuest=1;",
  "db": [
    {
      "ServerTime": "2026-02-05 15:32:44",
      "AccId": "15588848",
      "CurCode": "IDR",
      "Balance": "6",
      "Balance2": "6.36"
    }
  ],
  "matches": [
    {
      "MatchId": "20995182",
      "HomeName": "Manchester City",
      "AwayName": "Newcastle United",
      "LeagueName": "ENGLISH PREMIER LEAGUE",
      "MatchDate": "2026-02-05",
      "MatchTime": "20:00",
      "HomePrice": 1.85,
      "AwayPrice": 3.90,
      "OverPrice": 1.95,
      "UnderPrice": 1.85,
      "market": "FT_HDP",
      "line": "0"
    },
    {
      "MatchId": "20995183",
      "HomeName": "Arsenal",
      "AwayName": "Chelsea",
      "LeagueName": "ENGLISH PREMIER LEAGUE",
      "MatchDate": "2026-02-05",
      "MatchTime": "22:00",
      "HomePrice": 2.10,
      "AwayPrice": 3.20,
      "OverPrice": 2.05,
      "UnderPrice": 1.75,
      "market": "FT_HDP",
      "line": "0"
    },
    {
      "MatchId": "20995184",
      "HomeName": "Liverpool",
      "AwayName": "Tottenham",
      "LeagueName": "ENGLISH PREMIER LEAGUE",
      "MatchDate": "2026-02-05",
      "MatchTime": "21:00",
      "HomePrice": 1.75,
      "AwayPrice": 4.50,
      "OverPrice": 1.85,
      "UnderPrice": 2.00,
      "market": "FT_HDP",
      "line": "0"
    },
    {
      "MatchId": "20995185",
      "HomeName": "Barcelona",
      "AwayName": "Real Madrid",
      "LeagueName": "SPANISH LA LIGA",
      "MatchDate": "2026-02-05",
      "MatchTime": "23:00",
      "HomePrice": 2.20,
      "AwayPrice": 3.10,
      "OverPrice": 1.90,
      "UnderPrice": 1.95,
      "market": "FT_HDP",
      "line": "0"
    },
    {
      "MatchId": "20995186",
      "HomeName": "Bayern Munich",
      "AwayName": "Borussia Dortmund",
      "LeagueName": "GERMAN BUNDESLIGA",
      "MatchDate": "2026-02-05",
      "MatchTime": "20:30",
      "HomePrice": 1.65,
      "AwayPrice": 5.00,
      "OverPrice": 1.80,
      "UnderPrice": 2.05,
      "market": "FT_HDP",
      "line": "0"
    }
  ]
};

// Send AFB88 data via HTTP POST
const payload = {
  type: 'endpoint_captured',
  url: 'https://afb88.com/api/v1/matches',
  frameUrl: 'https://afb88.com/iframe/sports',
  account: 'B',
  responseBody: JSON.stringify(afbTestData1),
  clientId: 'AFB88-TEST-001'
};

const postData = JSON.stringify(payload);

const options = {
  hostname: '127.0.0.1',
  port: 3001,
  path: '/capture',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Sending AFB88 test data via HTTP POST...');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`Response: ${chunk}`);
  });
  res.on('end', () => {
    console.log('Request completed');
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();