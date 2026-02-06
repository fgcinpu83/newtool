const CDP = require('chrome-remote-interface');

async function listAllFrames() {
    const list = await CDP.List();
    const target = list.find(t => t.url.includes('NewIndex'));
    if (!target) return console.log("NewIndex not found");

    const client = await CDP({ target: target.webSocketDebuggerUrl });
    const { Page } = client;
    await Page.enable();

    const tree = await Page.getFrameTree();
    console.log(JSON.stringify(tree, null, 2));
    await client.close();
}
listAllFrames();
