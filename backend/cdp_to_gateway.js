const CDP = require('chrome-remote-interface');
const WebSocket = require('ws');

(async function(){
  try {
    const targets = await CDP.List();
    const target = targets.find(t => t.url.includes('NewIndex')) || targets[0];
    if (!target) return console.log('No target found');
    console.log('Attaching to', target.url);
    const client = await CDP({ target: target.webSocketDebuggerUrl });
    await client.Network.enable();

    const gw = new WebSocket('ws://localhost:3001');
    gw.on('open', () => console.log('Connected to gateway'));
    gw.on('error', (e) => console.error('GW ERR', e.message));

    client.on('Network.webSocketFrameReceived', (params) => {
      const payload = params.response && params.response.payloadData ? params.response.payloadData : null;
      if (!payload) return;
      const msg = {
        type: 'endpoint_captured',
        data: {
          url: target.url,
          frameUrl: target.url,
          account: 'A',
          type: 'STREAM_DATA',
          clientId: 'cdp-forwarder',
          payload: payload
        }
      };
      if (gw.readyState === WebSocket.OPEN) gw.send(JSON.stringify(msg));
      console.log('Forwarded frame to gateway (len:', payload.length, ')');
    });

    console.log('Forwarder running for 30s...');
    await new Promise(r => setTimeout(r, 30000));
    await client.close();
    gw.close();
    console.log('Done');
  } catch (e) { console.error(e); }
})();
