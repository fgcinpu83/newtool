const Redis = require('ioredis');
const axios = require('axios');
const qs = require('qs');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 4) {
    console.log('Usage: node test_process_bet_simulator.js <account:A|B> <Matchid> <Oddsid> <Odds> [Stake] [--send=<url>]');
    process.exit(1);
  }

  const account = args[0].toUpperCase();
  const Matchid = args[1];
  const Oddsid = args[2];
  const Odds = args[3];
  const Stake = args[4] ? Number(args[4]) : 10;
  const sendOpt = args.find(a => a.startsWith('--send='));
  const sendUrl = sendOpt ? sendOpt.split('=')[1] : null;

  let sinfo = 'NONE';
  let redis;
  try {
    redis = new Redis({ host: process.env.REDIS_HOST || '127.0.0.1', port: parseInt(process.env.REDIS_PORT || '6379') });
    const sinfoKey = `sinfo_${account}`;
    try {
      const got = await redis.get(sinfoKey);
      if (got) sinfo = got;
    } catch (e) {
      // Redis read failed, fallback to NONE
      sinfo = 'NONE';
    }
  } catch (e) {
    // Redis not available; continue with sinfo = 'NONE'
    sinfo = 'NONE';
  }

    const payload = {
      Matchid,
      Oddsid,
      Odds,
      Stake,
      sinfo,
      AcceptBetterOdds: false
    };

    console.log('---- Dry-run ProcessBet payload ----');
    console.log(JSON.stringify(payload, null, 2));

    if (sendUrl) {
      console.log(`Sending to ${sendUrl} ...`);
      const form = qs.stringify(payload);
      try {
        const resp = await axios.post(sendUrl, form, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 });
        console.log('Response status:', resp.status);
        console.log('Response data:', resp.data);
      } catch (err) {
        console.error('Send failed:', err.message || err);
      }
    } else {
      console.log('Use --send=<url> to actually POST this payload.');
    }
  if (redis) try { redis.quit(); } catch (e) { }
}

main().catch(e => { console.error(e); process.exit(1); });
