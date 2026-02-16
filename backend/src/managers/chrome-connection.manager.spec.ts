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


describe('ChromeConnectionManager — host-bridge (port 9223)', () => {
  test('attach(9223) succeeds when host.docker.internal HEAD responds 200', async () => {
    const fakeLauncher: any = { ensureRunning: jest.fn().mockResolvedValue({ launched: false, reused: true }) };
    const mgr = new ChromeConnectionManager(fakeLauncher);

    // mock raw HEAD probe against host.docker.internal
    const http = require('http') as any;
    const spy = jest.spyOn(http, 'request').mockImplementation((opts: any, cb: any) => {
      // call callback with a response-like object
      process.nextTick(() => {
        cb({ statusCode: 200, on: (ev: string, h: any) => { if (ev === 'end') h(); } });
      });
      return { on: jest.fn(), end: jest.fn() } as any;
    });

    // mock fetch used by fetchTabCount
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ([]) }) as any;

    const info = await mgr.attach(9223);
    expect(info.state).toBe('CONNECTED');

    spy.mockRestore();
  });

  test('openTab(9223) uses raw PUT and returns parsed JSON', async () => {
    const fakeLauncher: any = { ensureRunning: jest.fn().mockResolvedValue({ launched: false, reused: true }) };
    const mgr = new ChromeConnectionManager(fakeLauncher);

    // mark port 9223 as CONNECTED
    (mgr as any).ports.set(9223, { port: 9223, state: 'CONNECTED', tabs: 1, lastChecked: Date.now() });

    const http = require('http') as any;
    const spy = jest.spyOn(http, 'request').mockImplementation((opts: any, cb: any) => {
      process.nextTick(() => {
        const res: any = { statusCode: 200, on: (ev: string, h: any) => { if (ev === 'data') h(Buffer.from(JSON.stringify({ id: 'raw-tab' }))); if (ev === 'end') h(); } };
        cb(res);
      });
      return { on: jest.fn(), end: jest.fn() } as any;
    });

    const res = await mgr.openTab(9223, 'https://host.test');
    expect(res).toBeTruthy();
    expect((res as any).id).toBe('raw-tab');

    spy.mockRestore();
  });

  test('openTab(9223) raw PUT fails → falls back to fetch', async () => {
    const fakeLauncher: any = { ensureRunning: jest.fn().mockResolvedValue({ launched: false, reused: true }) };
    const mgr = new ChromeConnectionManager(fakeLauncher);

    // mark port 9223 as CONNECTED
    (mgr as any).ports.set(9223, { port: 9223, state: 'CONNECTED', tabs: 1, lastChecked: Date.now() });

    const http = require('http') as any;
    const spy = jest.spyOn(http, 'request').mockImplementation((opts: any, cb: any) => {
      process.nextTick(() => {
        const res: any = { statusCode: 500, on: (ev: string, h: any) => { if (ev === 'data') h(Buffer.from('fail')); if (ev === 'end') h(); } };
        cb(res);
      });
      return { on: jest.fn(), end: jest.fn() } as any;
    });

    // mock fetch fallback
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'fetch-tab' }) }) as any;

    const res = await mgr.openTab(9223, 'https://host.test');
    expect(res).toBeTruthy();
    expect((res as any).id).toBe('fetch-tab');

    spy.mockRestore();
  });
});
