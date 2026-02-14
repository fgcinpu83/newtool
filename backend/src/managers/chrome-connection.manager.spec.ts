import { ChromeConnectionManager } from './chrome-connection.manager'

describe('ChromeConnectionManager.openTab (HTTP + CDP fallback)', () => {
  let mgr: ChromeConnectionManager
  const fakeLauncher: any = { ensureRunning: jest.fn().mockResolvedValue({ launched: false, reused: true }) }
  const ORIGINAL_FETCH = global.fetch
  afterEach(() => {
    (global.fetch as any) = ORIGINAL_FETCH
    jest.resetModules()
    jest.clearAllMocks()
  })

  beforeEach(() => {
    mgr = new ChromeConnectionManager(fakeLauncher)
    // mark port 9222 as CONNECTED so openTab won't assert
    ;(mgr as any).ports.set(9222, { port: 9222, state: 'CONNECTED', tabs: 1, lastChecked: Date.now() })
  })

  test('uses HTTP /json/new when available', async () => {
    // mock fetch to return ok + JSON body
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'tab-1', url: 'https://afb88.com' }) }) as any

    const res = await mgr.openTab(9222, 'https://afb88.com')
    expect(res).toBeTruthy()
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(0)
    expect((res as any).url || (res as any).id).toBeTruthy()
  })

  test('falls back to CDP Target.createTarget when HTTP fails', async () => {
    // HTTP fails (non-ok)
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as any

    // mock chrome-remote-interface module
    const clientMock = {
      Target: { createTarget: jest.fn().mockResolvedValue({ targetId: 'cdp-1' }) },
      close: jest.fn().mockResolvedValue(true),
    }
    const cdpMock = jest.fn().mockResolvedValue(clientMock)
    jest.doMock('chrome-remote-interface', () => cdpMock)

    // re-import manager to pick up module mocks (not strictly necessary here since require is runtime)
    const mgr2 = mgr
    const res = await mgr2.openTab(9222, 'https://afb88.com')
    expect(res).toBeTruthy()
    expect((res as any).targetId).toBe('cdp-1')
    expect((clientMock.Target.createTarget as jest.Mock).mock.calls.length).toBe(1)
  })

  test('returns null when both HTTP and CDP fallback fail', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as any
    const cdpMock = jest.fn().mockRejectedValue(new Error('cdp-fail'))
    jest.doMock('chrome-remote-interface', () => cdpMock)

    const res = await mgr.openTab(9222, 'https://afb88.com')
    expect(res).toBeNull()
  })
})
