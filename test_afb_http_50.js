const http = require('http');

// Generate 50 AFB88 matches for testing large dataset processing
function generateMatches(count) {
  const leagues = [
    "ENGLISH PREMIER LEAGUE",
    "SPANISH LA LIGA",
    "GERMAN BUNDESLIGA",
    "ITALIAN SERIE A",
    "FRENCH LIGUE 1",
    "CHAMPIONS LEAGUE",
    "EUROPA LEAGUE"
  ];

  const teams = [
    "Manchester City", "Manchester United", "Arsenal", "Chelsea", "Liverpool", "Tottenham",
    "Barcelona", "Real Madrid", "Atletico Madrid", "Valencia", "Sevilla", "Villarreal",
    "Bayern Munich", "Borussia Dortmund", "RB Leipzig", "Bayer Leverkusen", "Wolfsburg", "Eintracht Frankfurt",
    "Juventus", "Inter Milan", "AC Milan", "Roma", "Napoli", "Lazio",
    "PSG", "Marseille", "Lyon", "Monaco", "Lille", "Nice",
    "Ajax", "PSV Eindhoven", "Feyenoord", "AZ Alkmaar", "Utrecht", "Groningen"
  ];

  const matches = [];

  for (let i = 0; i < count; i++) {
    const homeIndex = Math.floor(Math.random() * teams.length);
    let awayIndex = Math.floor(Math.random() * teams.length);
    while (awayIndex === homeIndex) {
      awayIndex = Math.floor(Math.random() * teams.length);
    }

    const league = leagues[Math.floor(Math.random() * leagues.length)];
    const matchDate = "2026-02-05";
    const matchTime = `${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;

    // Generate realistic odds
    const homePrice = (1.1 + Math.random() * 4).toFixed(2);
    const awayPrice = (1.5 + Math.random() * 8).toFixed(2);
    const overPrice = (1.7 + Math.random() * 1.5).toFixed(2);
    const underPrice = (1.7 + Math.random() * 1.5).toFixed(2);

    matches.push({
      "MatchId": `20995${String(100 + i).slice(-3)}`,
      "HomeName": teams[homeIndex],
      "AwayName": teams[awayIndex],
      "LeagueName": league,
      "MatchDate": matchDate,
      "MatchTime": matchTime,
      "HomePrice": parseFloat(homePrice),
      "AwayPrice": parseFloat(awayPrice),
      "OverPrice": parseFloat(overPrice),
      "UnderPrice": parseFloat(underPrice),
      "market": "FT_HDP",
      "line": "0"
    });
  }

  return matches;
}

// AFB88 Test Data with 50 matches
const afbTestData50 = {
  "error": "",
  "js": "if(NotGuest===0){window.location.reload();} NotGuest=1; NotGuest=1;",
  "db": [
    {
      "ServerTime": "2026-02-05 15:32:44",
      "AccId": "15588848",
      "CurCode": "IDR",
      "Balance": "6",
      "Balance2": "6.36"
    }
  ],
  "matches": generateMatches(50)
};

// Send AFB88 data via HTTP POST
const payload = {
  type: 'endpoint_captured',
  url: 'https://afb88.com/api/v1/matches',
  frameUrl: 'https://afb88.com/iframe/sports',
  account: 'B',
  responseBody: JSON.stringify(afbTestData50),
  clientId: 'AFB88-TEST-050'
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

console.log('Sending 50 AFB88 matches via HTTP POST...');

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