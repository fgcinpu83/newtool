// 🧪 MANUAL AFB TEST DATA - Struktur untuk Testing
// Copy-paste salah satu format di bawah ke dalam WebSocket message atau API response

// FORMAT 1: Object dengan HomePrice/AwayPrice (RECOMMENDED)
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
    }
  ]
};

// FORMAT 2: Array dengan odds array
const afbTestData2 = {
  "error": "",
  "js": "if(NotGuest===0){window.location.reload();} NotGuest=1;",
  "db": [
    {
      "ServerTime": "2026-02-05 15:32:44",
      "AccId": "15588848",
      "Balance": "6"
    }
  ],
  "matches": [
    {
      "MatchId": "20995182",
      "HomeName": "Manchester City",
      "AwayName": "Newcastle United",
      "LeagueName": "ENGLISH PREMIER LEAGUE",
      "odds": [1.85, 3.90, 1.95, 1.85], // [Home, Away, Over, Under]
      "market": "FT_HDP"
    },
    {
      "MatchId": "20995183",
      "HomeName": "Arsenal",
      "AwayName": "Chelsea",
      "LeagueName": "ENGLISH PREMIER LEAGUE",
      "odds": [2.10, 3.20, 2.05, 1.75],
      "market": "FT_HDP"
    }
  ]
};

// FORMAT 3: Positional Array (SABA style)
const afbTestData3 = [
  20995182, // MatchId
  0, 0, 0, 0, // padding
  "Manchester City", // Home
  "Newcastle United", // Away
  0, 0, 0, // padding
  1.85, // Home odds
  3.90, // Away odds
  0, // line
  "ENGLISH PREMIER LEAGUE" // league
];

// FORMAT 4: WebSocket style (simplified)
const afbWebSocketData = [
  [1, "test_session_id", "r", 0, 1, 1, 0, 1, 2, "EN-AU", "1", 1, "test_client_id"],
  [], // empty
  [], // empty
  [
    [
      75767, // league id
      "ENGLISH PREMIER LEAGUE", // league name
      0,
      400, // sport id
      [
        [
          20995182, // match id
          0,
          20995198,
          "0 - 0", // score
          0,
          "20:00", // time
          1,
          30,
          1,
          1,
          12547761,
          31116,
          140374,
          "Manchester City", // home
          "Newcastle United", // away
          "16",
          "14",
          0,
          1,
          0,
          0,
          59,
          0,
          2.5, // OU line
          -13.3, // HDP line
          1.85, // Home HDP odds
          3.90, // Away HDP odds
          1.95, // Over odds
          1.85, // Under odds
          10,
          6.7,
          3.45,
          1.52,
          8.5,
          -9.8,
          -9,
          1,
          1,
          1,
          0,
          1.5,
          -12.3,
          11.2,
          14.4,
          -16.9,
          -25,
          19.2,
          28,
          4.3,
          1.2,
          9.1,
          -5.7,
          -4,
          453329528,
          "0",
          "2026-02-05 20:00:00", // datetime
          1,
          "GL750",
          1,
          0,
          0,
          75767,
          31116
        ]
      ]
    ]
  ]
];

// 📝 CARA PENGGUNAAN:
// 1. Pilih salah satu format di atas
// 2. Inject ke dalam WebSocket message atau API response
// 3. Pastikan URL mengandung "AFB88" atau "afb" atau "jps9" atau "prosportslive"
// 4. Parser akan otomatis detect dan extract odds

module.exports = {
  afbTestData1,
  afbTestData2,
  afbTestData3,
  afbWebSocketData
};