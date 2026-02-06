const io = require('socket.io-client');

const socket = io('http://127.0.0.1:3001');

socket.on('connect', () => {
    console.log('✅ Connected to Backend for Session Injection');

    // MOCK SESSION for CMD
    const mockSession = {
        account: 'B',
        provider: 'CMD368',
        type: 'session_capture',
        data: {
            url: 'https://member.cmd368.com/Sports', // Typical or dummy
            cookies: 'ASP.NET_SessionId=dummy; params=dummy',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            cookie: 'ASP.NET_SessionId=dummy; params=dummy'
        },
        isInternal: false
    };

    console.log('💉 Injecting FORCE SESSION...');
    socket.emit('endpoint_captured', mockSession);

    console.log('⏳ Waiting for worker to react...');
    setTimeout(() => {
        console.log('👋 Done. Check cmd_debug.log');
        process.exit(0);
    }, 5000);
});
