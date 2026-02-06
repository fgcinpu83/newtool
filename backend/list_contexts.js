const CDP = require('chrome-remote-interface');

async function listContexts() {
    const mainTarget = (await CDP.List()).find(t => t.url.includes('NewIndex'));
    if (!mainTarget) return console.log("Target not found");

    const client = await CDP({ target: mainTarget.webSocketDebuggerUrl });
    const { Runtime, Page } = client;
    await Page.enable();
    await Runtime.enable();

    client.on('Runtime.executionContextCreated', (params) => {
        console.log(`Context Created: ID=${params.context.id} Origin=${params.context.origin} Name=${params.context.name}`);
    });

    // Trigger context discovery
    await Page.reload();
    console.log("Reloading to capture contexts...");
    await new Promise(r => setTimeout(r, 10000));
    await client.close();
}
listContexts();
