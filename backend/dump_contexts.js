const CDP = require('chrome-remote-interface');

async function dumpAll() {
    const mainTarget = (await CDP.List()).find(t => t.url.includes('NewIndex'));
    const client = await CDP({ target: mainTarget.webSocketDebuggerUrl });
    const { Runtime } = client;
    await Runtime.enable();

    // Search for context IDs
    const contextMap = new Map();
    client.on('Runtime.executionContextCreated', (p) => {
        console.log(`Context: ID=${p.context.id} Name=${p.context.name} Origin=${p.context.origin}`);
        contextMap.set(p.context.id, p.context);
    });

    // Trigger context creation by calling Page.enable and waiting
    await client.Page.enable();
    await new Promise(r => setTimeout(r, 5000));

    // For each context, try to dump body
    const contexts = Array.from(contextMap.keys());
    for (let id of contexts) {
        try {
            console.log(`Dumping Context ${id}...`);
            const { result } = await Runtime.evaluate({
                expression: 'document.body.innerText.substring(0, 500)',
                contextId: id
            });
            console.log(`Result ${id}: ${result.value}`);
        } catch (e) { console.log(`Error ${id}: ${e.message}`); }
    }
    await client.close();
}
dumpAll();
