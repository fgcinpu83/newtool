const CDP = require('chrome-remote-interface');
const io = require('socket.io-client');

(async function(){
  try {
    const targets = await CDP.List();
    const target = targets.find(t => t.url.includes('NewIndex')) || targets[0];
    if (!target) return console.log('No target found');
    console.log('Attaching to', target.url);
    const client = await CDP({ target: target.webSocketDebuggerUrl });
    await client.Network.enable();

    const gw = io.connect('http://localhost:8080', { transports: ['websocket'], reconnection: false });
    gw.on('connect', () => console.log('Connected to socket.io gateway')); 
    gw.on('connect_error', (e) => console.error('gw connect err', e && e.message));

    client.on('Network.webSocketFrameReceived', (params) => {
      const payload = params.response && params.response.payloadData ? params.response.payloadData : null;
      if (!payload) return;
      const data = {
        url: target.url,
        frameUrl: target.url,
        account: 'A',
        type: 'STREAM_DATA',
        clientId: 'cdp-socketio-forwarder',
        Matchid: 'cdp',
        ... (typeof payload === 'string' ? { payload: payload } : {})
      };
      gw.emit('endpoint_captured', data);
      console.log('Emitted endpoint_captured len', payload.length);
    });

    console.log('Forwarder running for 20s...');
    await new Promise(r => setTimeout(r, 20000));
    await client.close();
    gw.close();
    console.log('Done');
  } catch (e) { console.error(e); }
})();
