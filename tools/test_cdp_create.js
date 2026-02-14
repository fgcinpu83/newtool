const CDP = require('chrome-remote-interface')

async function run() {
  try {
    const client = await CDP({ port: 9222 })
    console.log('CDP client connected')
    if (client && client.Target && typeof client.Target.createTarget === 'function') {
      const r = await client.Target.createTarget({ url: 'https://afb88.com' })
      console.log('createTarget result:', r)
    } else {
      console.log('Target.createTarget not available on client')
    }
    try { await client.close() } catch(e){}
  } catch (e) {
    console.error('CDP error:', e && e.message || e)
  }
}

run()
