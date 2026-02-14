import { CommandRouterService } from '../command/command-router.service';
import { WorkerService } from './worker.service';
import { InternalEventBusService } from '../events/internal-event-bus.service';
import { InternalFsmService, ToggleState } from '../events/internal-fsm.service';

// Minimal mocks for dependencies used by WorkerService in TOGGLE handling
const makeMocks = () => {
  const gateway: any = {
    sendUpdate: jest.fn(),
    trafficBus: { on: jest.fn() },
    commandEvents: { on: jest.fn() },
    server: {}
  };

  const redisService: any = { setConfig: jest.fn().mockResolvedValue(true), set: jest.fn().mockResolvedValue(true) };
  const discoveryService: any = { getStats: jest.fn().mockReturnValue({ registryASize: 0, registryBSize: 0 }), clearAllMemory: jest.fn(), setBypass: jest.fn() };
  const pairingService: any = {};
  const guardianService: any = {};
  const registry: any = { getContract: jest.fn() };
  const decoder: any = { decode: jest.fn().mockResolvedValue(null), getMatchDataConfidence: jest.fn().mockReturnValue({ confidence: 0, reason: '' }) };
  const providerManager: any = { isSystemReady: jest.fn().mockReturnValue(true), getSystemStatus: jest.fn().mockReturnValue({}) };
  const chromeManager: any = { attach: jest.fn().mockResolvedValue({ state: 'CONNECTED', tabs: 1 }), isConnected: jest.fn().mockReturnValue(true), getTabs: jest.fn().mockResolvedValue([]) };

  const commandRouter = new CommandRouterService();
  const internalBus: any = { publish: jest.fn(), on: jest.fn() };

  const internalFsm: Partial<InternalFsmService> = {
    get: jest.fn().mockReturnValue(ToggleState.IDLE),
    issueToken: jest.fn().mockReturnValue('tok'),
    trustedTransition: jest.fn(),
    transition: jest.fn()
  };

  return { gateway, redisService, discoveryService, pairingService, guardianService, registry, decoder, providerManager, chromeManager, commandRouter, internalBus, internalFsm };
};

describe('WorkerService TOGGLE_ACCOUNT hardening (B)', () => {
  let mocks: ReturnType<typeof makeMocks>;
  let svc: WorkerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mocks = makeMocks();

    // Construct WorkerService with mocked collaborators
    svc = new WorkerService(
      // marketService (not used in these tests)
      ({} as any),
      mocks.gateway,
      mocks.redisService,
      mocks.discoveryService,
      mocks.pairingService,
      mocks.guardianService,
      mocks.registry,
      mocks.decoder,
      mocks.providerManager,
      mocks.chromeManager,
      mocks.commandRouter,
      mocks.internalBus,
      (mocks.internalFsm as unknown) as InternalFsmService
    );

    // Use a real AccountRuntimeManager so runtime entries are created on TOGGLE
    (svc as any).runtimeManager = new (require('../runtime/account-runtime.manager').AccountRuntimeManager)(mocks.internalFsm as any);

    // Ensure onModuleInit runs to register command handlers
    await svc.onModuleInit();
  });

  test('rejects TOGGLE ON when whitelabel URL is missing', async () => {
    // ensure no url configured
    svc['config'] = { urlA: '', urlB: '', accountA_active: false, accountB_active: false };

    const res = await mocks.commandRouter.route({ type: 'TOGGLE_ACCOUNT', payload: { account: 'A', enabled: true } });

    // Expect a toggle:failed update was sent with MISSING_WHITELABEL_URL
    expect(mocks.gateway.sendUpdate).toHaveBeenCalled();
    const calls = (mocks.gateway.sendUpdate as jest.Mock).mock.calls;
    const found = calls.find((c: any[]) => c[0] === 'toggle:failed' && c[1].reason === 'MISSING_WHITELABEL_URL');
    expect(found).toBeDefined();

    // FSM should not have transitioned and redis should not mark account active
    expect((mocks.internalFsm.get as jest.Mock).mock.results.length).toBeGreaterThan(0);
    expect(mocks.redisService.setConfig).not.toHaveBeenCalledWith(expect.objectContaining({ accountA_active: true }));
  });

  test('rejects TOGGLE ON when chrome not ready after open request', async () => {
    // configure url so WorkerService will attempt to open browser
    svc['config'] = { urlA: 'https://example.com', urlB: '', accountA_active: false, accountB_active: false };

    // Ensure chromeReady remains false
    svc.setChromeReady(false);

    const routePromise = mocks.commandRouter.route({ type: 'TOGGLE_ACCOUNT', payload: { account: 'A', enabled: true } });

    await routePromise;

    // internalBus.publish should have been called to request open
    expect(mocks.internalBus.publish).toHaveBeenCalledWith('REQUEST_OPEN_BROWSER', expect.objectContaining({ account: 'A' }));

    // Because chrome did not become ready, toggle:failed should be emitted with CHROME_NOT_READY_AFTER_OPEN
    const calls = (mocks.gateway.sendUpdate as jest.Mock).mock.calls;
    const found = calls.find((c: any[]) => c[0] === 'toggle:failed' && c[1].reason === 'CHROME_NOT_READY_AFTER_OPEN');
    expect(found).toBeDefined();

    // FSM should NOT have performed a trustedTransition to STARTING
    expect((mocks.internalFsm.trustedTransition as jest.Mock).mock.calls.length).toBe(0);
  });

  test('happy path: emits REQUEST_OPEN_BROWSER and transitions FSM when chromeReady', async () => {
    svc['config'] = { urlA: 'https://example.com', urlB: '', accountA_active: false, accountB_active: false };

    // Simulate Chrome already ready
    svc.setChromeReady(true);

    await mocks.commandRouter.route({ type: 'TOGGLE_ACCOUNT', payload: { account: 'A', enabled: true } });

    // internalBus.publish must be called
    expect(mocks.internalBus.publish).toHaveBeenCalledWith('REQUEST_OPEN_BROWSER', expect.objectContaining({ account: 'A' }));

    // FSM trustedTransition should have been invoked for STARTING
    expect((mocks.internalFsm.trustedTransition as jest.Mock)).toHaveBeenCalledWith('A', ToggleState.STARTING, expect.anything());

    // FSM should also progress to RUNNING in the TOGGLE_ACCOUNT flow
    const gwCalls = (mocks.gateway.sendUpdate as jest.Mock).mock.calls;
    const runCall = gwCalls.find((c: any[]) => c[0] === 'fsm:transition' && c[1].toState === ToggleState.RUNNING);
    expect(runCall).toBeDefined();

    // Redis config should be updated to reflect active account
    expect(mocks.redisService.setConfig).toHaveBeenCalled();
    expect(svc['config'].accountA_active).toBe(true);
  });

  test('creates AccountRuntime entry when TOGGLE_ACCOUNT received', async () => {
    svc['config'] = { urlA: 'https://example.com', urlB: '', accountA_active: false, accountB_active: false };

    // Ensure no runtime entries yet
    expect((svc as any).runtimeManager.getAll().length).toBe(0);

    // Simulate Chrome ready so toggle proceeds
    svc.setChromeReady(true);

    await mocks.commandRouter.route({ type: 'TOGGLE_ACCOUNT', payload: { account: 'A', enabled: true } });

    const all = (svc as any).runtimeManager.getAll();
    const found = all.find((r: any) => r.accountId === 'A');
    expect(found).toBeDefined();
  });

  test('waits for BROWSER_OPENED and proceeds when event arrives', async () => {
    svc['config'] = { urlA: 'https://example.com', urlB: '', accountA_active: false, accountB_active: false };

    // Simulate Chrome already ready so chromeReady guard will pass after browser open
    svc.setChromeReady(true);

    // Trigger the route but don't await immediately so we can invoke the internalBus callback
    const routePromise = mocks.commandRouter.route({ type: 'TOGGLE_ACCOUNT', payload: { account: 'A', enabled: true } });

    // Find the handler that WorkerService registered for BROWSER_OPENED and invoke it
    const onCalls = (mocks.internalBus.on as jest.Mock).mock.calls;
    const browserOpenedCall = onCalls.find((c: any[]) => c[0] === 'BROWSER_OPENED');
    expect(browserOpenedCall).toBeDefined();
    const browserOpenedHandler = browserOpenedCall[1];

    // Simulate the BrowserAutomationService reporting an opened tab
    browserOpenedHandler({ account: 'A', url: 'https://example.com' });

    await routePromise;

    // Ensure FSM transitioned to STARTING (trustedTransition still used)
    expect((mocks.internalFsm.trustedTransition as jest.Mock)).toHaveBeenCalledWith('A', ToggleState.STARTING, expect.anything());

    // Ensure the TOGGLE_ACCOUNT flow completed to RUNNING
    const gwCalls = (mocks.gateway.sendUpdate as jest.Mock).mock.calls;
    const runCall = gwCalls.find((c: any[]) => c[0] === 'fsm:transition' && c[1].toState === ToggleState.RUNNING);
    expect(runCall).toBeDefined();
  });

  test('considers Chrome tab present as successful open when BROWSER_OPENED is missed (fallback)', async () => {
    svc['config'] = { urlA: 'https://example.com', urlB: '', accountA_active: false, accountB_active: false };

    // Simulate Chrome already ready
    svc.setChromeReady(true);

    // Mock chromeManager.getTabs to report the whitelabel URL already present
    (mocks.chromeManager.getTabs as jest.Mock).mockResolvedValue([{ id: '1', url: 'https://example.com/home' }]);

    // Do NOT invoke BROWSER_OPENED on the internal bus (simulate missed event)
    await mocks.commandRouter.route({ type: 'TOGGLE_ACCOUNT', payload: { account: 'A', enabled: true } });

    // internalBus.publish must have been called to request open
    expect(mocks.internalBus.publish).toHaveBeenCalledWith('REQUEST_OPEN_BROWSER', expect.objectContaining({ account: 'A' }));

    // FSM trustedTransition should have been invoked for STARTING
    expect((mocks.internalFsm.trustedTransition as jest.Mock)).toHaveBeenCalledWith('A', ToggleState.STARTING, expect.anything());

    // FSM should progress to RUNNING via the TOGGLE_ACCOUNT flow fallback
    const gwCalls = (mocks.gateway.sendUpdate as jest.Mock).mock.calls;
    const runCall = gwCalls.find((c: any[]) => c[0] === 'fsm:transition' && c[1].toState === ToggleState.RUNNING);
    expect(runCall).toBeDefined();
  });

  test('emits toggle:failed when BROWSER_OPEN timed out', async () => {
    svc['config'] = { urlA: 'https://example.com', urlB: '', accountA_active: false, accountB_active: false };

    // Simulate Chrome ready to isolate the timeout behavior
    svc.setChromeReady(true);

    await mocks.commandRouter.route({ type: 'TOGGLE_ACCOUNT', payload: { account: 'A', enabled: true } });

    // Because we did NOT invoke the BROWSER_OPENED handler, WorkerService should emit toggle:failed with timeout
    const calls = (mocks.gateway.sendUpdate as jest.Mock).mock.calls;
    const found = calls.find((c: any[]) => c[0] === 'toggle:failed' && c[1].reason === 'BROWSER_OPEN_TIMEOUT');
    expect(found).toBeDefined();

    // FSM should not have started
    expect((mocks.internalFsm.trustedTransition as jest.Mock).mock.calls.length).toBe(0);
  });

  test('emits toggle:failed when BROWSER_OPEN_FAILED is published', async () => {
    svc['config'] = { urlA: 'https://example.com', urlB: '', accountA_active: false, accountB_active: false };

    // Ensure chromeReady true so we only test the BROWSER_OPEN_FAILED path
    svc.setChromeReady(true);

    const routePromise = mocks.commandRouter.route({ type: 'TOGGLE_ACCOUNT', payload: { account: 'A', enabled: true } });

    const onCalls = (mocks.internalBus.on as jest.Mock).mock.calls;
    const browserFailedCall = onCalls.find((c: any[]) => c[0] === 'BROWSER_OPEN_FAILED');
    expect(browserFailedCall).toBeDefined();
    const browserFailedHandler = browserFailedCall[1];

    browserFailedHandler({ account: 'A', error: 'CDP failed' });

    await routePromise;

    const calls = (mocks.gateway.sendUpdate as jest.Mock).mock.calls;
    const found = calls.find((c: any[]) => c[0] === 'toggle:failed' && c[1].reason === 'BROWSER_OPEN_FAILED');
    expect(found).toBeDefined();

    expect((mocks.internalFsm.trustedTransition as jest.Mock).mock.calls.length).toBe(0);
  });
});
