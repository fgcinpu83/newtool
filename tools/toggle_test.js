const io = require('socket.io-client')

const URL = process.env.BACKEND_URL || 'http://localhost:3001'
console.log('Connecting to', URL)
const s = io(URL, { autoConnect: true })

s.on('connect', () => {
  console.log('[test] connected', s.id)

  s.on('backend_state', (d) => console.log('[evt] backend_state', JSON.stringify(d)))

  const seq = async () => {
    await new Promise(r => setTimeout(r, 500))
    console.log('-> GET_STATUS')
    s.emit('command', { type: 'GET_STATUS' })

    await new Promise(r => setTimeout(r, 1000))
    console.log('-> TOGGLE_ACCOUNT A ON (scoped)')
    s.emit('command', { type: 'TOGGLE_ACCOUNT', payload: { accountId: 'A', enabled: true } })

    await new Promise(r => setTimeout(r, 1500))
    console.log('-> TOGGLE_ACCOUNT B ON (scoped)')
    s.emit('command', { type: 'TOGGLE_ACCOUNT', payload: { accountId: 'B', enabled: true } })

    await new Promise(r => setTimeout(r, 1500))
    console.log('-> TOGGLE_ACCOUNT B OFF (scoped)')
    s.emit('command', { type: 'TOGGLE_ACCOUNT', payload: { accountId: 'B', enabled: false } })

    await new Promise(r => setTimeout(r, 1500))
    console.log('Done, disconnecting')
    s.disconnect()
    process.exit(0)
  }

  seq()
})

s.on('connect_error', (e) => {
  console.error('connect_error', e && e.message)
  process.exit(1)
})

s.on('disconnect', () => console.log('[test] disconnected'))
