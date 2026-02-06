const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function listAll() {
    const targets = await CDP.List();
    console.log('=== TARGETS LIST ===');
    targets.forEach((t, i) => {
        console.log(`[${i}] ${t.type} | ${t.url}`);
    });
}
listAll();
