const io = require('socket.io-client')

const URL = process.env.BACKEND_URL || 'http://localhost:3001'
console.log('Connecting to', URL)
const s = io(URL, { autoConnect: true })

s.on('connect', () => {
  console.log('[client] connected', s.id)
  // Listen to some events
  s.on('system_status', (d) => console.log('[evt] system_status', JSON.stringify(d).substring(0,200)))
  s.on('backend_state', (d) => console.log('[evt] backend_state', JSON.stringify(d).substring(0,200)))
  s.on('debug:opps', (d) => console.log('[evt] debug:opps', JSON.stringify(d).substring(0,200)))

  // Sequence commands with delays
  setTimeout(() => {
    console.log('-> GET_STATUS')
    s.emit('command', { type: 'GET_STATUS' })
  }, 500)

  setTimeout(() => {
    console.log('-> TOGGLE_ACCOUNT A ON')
    s.emit('command', { type: 'TOGGLE_ACCOUNT', payload: { account: 'A', active: true } })
  }, 1500)

  setTimeout(() => {
    console.log('-> TOGGLE_ACCOUNT A OFF')
    s.emit('command', { type: 'TOGGLE_ACCOUNT', payload: { account: 'A', active: false } })
  }, 3000)

  setTimeout(() => {
    console.log('-> UPDATE_CONFIG')
    s.emit('command', { type: 'UPDATE_CONFIG', payload: { min: 2.5, max: 20.0, urlA: 'https://saba.example', urlB: 'https://afb.example' } })
  }, 4500)

  setTimeout(() => {
    console.log('-> LOG_OPPS')
    s.emit('command', { type: 'LOG_OPPS', payload: { sample: [{ id: 'op1', profit: 3.2 }] } })
  }, 6000)

  setTimeout(() => {
    console.log('Done, disconnecting')
    s.disconnect()
    process.exit(0)
  }, 8000)
})

s.on('connect_error', (e) => {
  console.error('connect_error', e.message || e)
  process.exit(1)
})

s.on('disconnect', () => console.log('[client] disconnected'))
