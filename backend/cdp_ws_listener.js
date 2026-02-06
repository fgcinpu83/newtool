const CDP = require('chrome-remote-interface');

(async function() {
  try {
    const targets = await CDP.List();
    const target = targets.find(t => t.url.includes('NewIndex')) || targets[0];
    if (!target) return console.log('No target found');
    console.log('Attaching to', target.url);
    const client = await CDP({ target: target.webSocketDebuggerUrl });
    await client.Network.enable();
    client.on('Network.webSocketFrameReceived', (params) => {
      try {
        const payload = params.response.payloadData;
        console.log('[WS-FRAME]', payload ? (payload.length>300 ? payload.substring(0,300)+'...' : payload) : '<empty>');
      } catch(e){ console.error('parse err', e.message); }
    });
    console.log('Listening for 15s...');
    await new Promise(r => setTimeout(r, 15000));
    await client.close();
    console.log('Done');
  } catch (e) { console.error(e); }
})();
