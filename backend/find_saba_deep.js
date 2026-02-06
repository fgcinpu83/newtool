const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function findSabaDeep() {
    const mainTarget = (await CDP.List()).find(t => t.url.includes('NewIndex'));
    if (!mainTarget) return console.log("Main target not found");

    const client = await CDP({ target: mainTarget.webSocketDebuggerUrl });
    const { Target, Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();

    console.log("Connected to main. Waiting 5s for iframes...");
    await new Promise(r => setTimeout(r, 5000));

    // Check iframes specifically
    const frames = await Page.getFrameTree();
    console.log("Frame Tree:", JSON.stringify(frames, null, 2));

    // Try to get all targets from the browser's perspective
    const allTargets = await Target.getTargets();
    console.log("All Browser Targets:", JSON.stringify(allTargets, null, 2));

    await client.close();
}
findSabaDeep();
