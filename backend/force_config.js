
const Redis = require('ioredis');
const redis = new Redis({
    host: '127.0.0.1',
    port: 6379 // Default
});

async function update() {
    const config = {
        min: 0.5,
        max: 5.0,
        accountA_active: true,
        accountB_active: true,
        urlA: 'https://afb88.com', // Placeholder
        urlB: 'https://qq188pjm.com' // VERIFIED WORKING
    };

    await redis.set('arbitrage_config', JSON.stringify(config));
    console.log('✅ Config forced to qq188pjm.com');
    process.exit(0);
}

update();
