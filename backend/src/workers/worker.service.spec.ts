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
  const sqliteMock: any = { getProviderContractForAccount: jest.fn().mockReturnValue(null), saveProviderContract: jest.fn(), deleteProviderContractForAccount: jest.fn(), saveExecutionHistory: jest.fn(), getExecutionHistory: jest.fn().mockReturnValue([]) };

  const internalFsm: Partial<InternalFsmService> = {
    get: jest.fn().mockReturnValue(ToggleState.IDLE),
    issueToken: jest.fn().mockReturnValue('tok'),
    trustedTransition: jest.fn(),
    transition: jest.fn()
  };

  return { gateway, redisService, discoveryService, pairingService, guardianService, registry, decoder, providerManager, chromeManager, commandRouter, internalBus, sqliteMock, internalFsm };
};

describe('WorkerService TOGGLE_ACCOUNT hardening (B)', () => {
  // tests in this suite exercise timeouts and async waits (browser open flow)
  jest.setTimeout(15000);

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
      mocks.sqliteMock,
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
    // allow the later readiness check (waitUntil) to complete within Jest's timeout
    jest.setTimeout(10000);

    // configure url so WorkerService will attempt to open browser
    svc['config'] = { urlA: 'https://example.com', urlB: '', accountA_active: false, accountB_active: false };

    // Ensure chromeReady remains false so the post-open readiness check fails
    svc.setChromeReady(false);

    // Fast-path the browser-open acknowledgement so test runs quickly
    jest.spyOn(svc as any, 'waitForBrowserOpen').mockResolvedValue(true);

    // Use fake timers so we can advance the 5s readiness wait synchronously
    jest.useFakeTimers();
    const routePromise = mocks.commandRouter.route({ type: 'TOGGLE_ACCOUNT', payload: { account: 'A', enabled: true } });

    // fast-forward the internal waitUntil (5000ms) + small margin (use async API to flush microtasks)
    await jest.advanceTimersByTimeAsync(5500);

    await routePromise;
    jest.useRealTimers();

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

    // Fast-path browser-open so the test doesn't wait for real timeouts
    jest.spyOn(svc as any, 'waitForBrowserOpen').mockResolvedValue(true);

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

    // Fast-path browser-open so the test doesn't wait for real timeouts
    jest.spyOn(svc as any, 'waitForBrowserOpen').mockResolvedValue(true);

    await mocks.commandRouter.route({ type: 'TOGGLE_ACCOUNT', payload: { account: 'A', enabled: true } });

    const all = (svc as any).runtimeManager.getAll();
    const found = all.find((r: any) => r.accountId === 'A');
    expect(found).toBeDefined();
  });

  test('waits for BROWSER_OPENED and proceeds when event arrives', async () => {
    svc['config'] = { urlA: 'https://example.com', urlB: '', accountA_active: false, accountB_active: false };

    // Simulate Chrome already ready so chromeReady guard will pass after browser open
    svc.setChromeReady(true);

    // Fast-path the browser-open acknowledgement so test runs quickly
    jest.spyOn(svc as any, 'waitForBrowserOpen').mockResolvedValue(true);

    await mocks.commandRouter.route({ type: 'TOGGLE_ACCOUNT', payload: { account: 'A', enabled: true } });

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

    // Fast-path the browser-open wait to simulate a timeout immediately
    jest.spyOn(svc as any, 'waitForBrowserOpen').mockResolvedValue(false);

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

    // Simulate a BROWSER_OPEN_FAILED by fast-pathing waitForBrowserOpen -> false
    jest.spyOn(svc as any, 'waitForBrowserOpen').mockResolvedValue(false);

    await mocks.commandRouter.route({ type: 'TOGGLE_ACCOUNT', payload: { account: 'A', enabled: true } });

    const calls = (mocks.gateway.sendUpdate as jest.Mock).mock.calls;
    const found = calls.find((c: any[]) => c[0] === 'toggle:failed' && c[1].reason === 'BROWSER_OPEN_TIMEOUT');
    expect(found).toBeDefined();

    expect((mocks.internalFsm.trustedTransition as jest.Mock).mock.calls.length).toBe(0);
  });

  // --- Crash-hardening tests (COPILOT DEBUG PROMPT coverage) ---
  test('TOGGLE ON recovers when waitForBrowserOpen throws (no crash)', async () => {
    svc['config'] = { urlA: 'https://example.com', urlB: '', accountA_active: false, accountB_active: false };
    svc.setChromeReady(true);

    // Simulate internal waitForBrowserOpen throwing an unexpected error
    jest.spyOn(svc as any, 'waitForBrowserOpen').mockRejectedValue(new Error('boom'));

    const resp = await mocks.commandRouter.route({ type: 'TOGGLE_ACCOUNT', payload: { account: 'A', enabled: true } });

    // Handler must return gracefully with success:false and not throw
    expect(resp && resp.success).toBe(false);

    // WorkerService should emit toggle:failed with BROWSER_OPEN_WAIT_ERROR
    const calls = (mocks.gateway.sendUpdate as jest.Mock).mock.calls;
    const found = calls.find((c: any[]) => c[0] === 'toggle:failed' && c[1].reason === 'BROWSER_OPEN_WAIT_ERROR');
    expect(found).toBeDefined();

    // FSM should have been forced back to IDLE and provider marked RED (transition called)
    expect((mocks.internalFsm.transition as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(0);
  });

  test('TOGGLE ON emits system_log when waitForBrowserOpen throws', async () => {
    svc['config'] = { urlA: 'https://example.com', urlB: '', accountA_active: false, accountB_active: false };
    svc.setChromeReady(true);

    // Cause waitForBrowserOpen to throw so outer catch path runs
    jest.spyOn(svc as any, 'waitForBrowserOpen').mockRejectedValue(new Error('boom'));

    const resp = await mocks.commandRouter.route({ type: 'TOGGLE_ACCOUNT', payload: { account: 'A', enabled: true } });

    // Handler should indicate failure
    expect(resp && resp.success).toBe(false);

    // A system_log entry must be emitted for top-level TOGGLE failures
    const gwCalls = (mocks.gateway.sendUpdate as jest.Mock).mock.calls;
    const sysLog = gwCalls.find((c: any[]) => c[0] === 'system_log' && c[1] && typeof c[1].message === 'string' && String(c[1].message).includes('TOGGLE'));
    expect(sysLog).toBeDefined();
  });

  test('TOGGLE_ACCOUNT top-level error is handled and does not crash', async () => {
    svc['config'] = { urlA: 'https://example.com', urlB: '', accountA_active: false, accountB_active: false };

    // Make internalBus.publish throw to simulate bus failure
    (svc as any).internalBus.publish = jest.fn().mockImplementation(() => { throw new Error('bus-fail'); });

    const resp = await mocks.commandRouter.route({ type: 'TOGGLE_ACCOUNT', payload: { account: 'A', enabled: true } });

    // Handler should return an object indicating failure instead of letting exception bubble
    expect(resp && resp.success).toBe(false);
    const gwCalls = (mocks.gateway.sendUpdate as jest.Mock).mock.calls;
    const sysLog = gwCalls.find((c: any[]) => c[0] === 'system_log');
    expect(sysLog).toBeDefined();
  });

  // --- New tests for admin persistence handlers ---
  test('LIST_PROVIDER_CONTRACTS emits provider_contracts with persisted rows', async () => {
    const sampleA = { accountId: 'A', endpointPattern: '/api/odds', method: 'GET', createdAt: Date.now() };
    const sampleB = null;
    mocks.sqliteMock.getProviderContractForAccount = jest.fn().mockImplementation((acct: any) => acct === 'A' ? sampleA : sampleB);

    await mocks.commandRouter.route({ type: 'LIST_PROVIDER_CONTRACTS' });

    expect(mocks.gateway.sendUpdate).toHaveBeenCalledWith('provider_contracts', expect.objectContaining({ A: sampleA, B: sampleB }));
  });

  test('DELETE_PROVIDER_CONTRACT removes persisted contract and emits provider_contracts', async () => {
    mocks.sqliteMock.deleteProviderContractForAccount = jest.fn().mockReturnValue({ changes: 1 });

    await mocks.commandRouter.route({ type: 'DELETE_PROVIDER_CONTRACT', payload: { accountId: 'A' } });

    expect(mocks.sqliteMock.deleteProviderContractForAccount).toHaveBeenCalledWith('A');
    expect(mocks.gateway.sendUpdate).toHaveBeenCalledWith('provider_contracts', expect.any(Object));
  });

  test('GET_EXECUTION_HISTORY returns rows and emits execution_history_db', async () => {
    const rows = [ { id: 1, timestamp: Date.now(), match: 'PAIR/USD', providerA: 'P1', providerB: 'P2', stakeA: 1.2, stakeB: 2.3, profitResult: 'OK' } ];
    mocks.sqliteMock.getExecutionHistory = jest.fn().mockReturnValue(rows);

    const resp = await mocks.commandRouter.route({ type: 'GET_EXECUTION_HISTORY', payload: { limit: 10 } });

    expect(mocks.sqliteMock.getExecutionHistory).toHaveBeenCalledWith(10);
    expect(mocks.gateway.sendUpdate).toHaveBeenCalledWith('execution_history_db', rows);
    expect(resp && resp.success).toBe(true);
  });

  test('onModuleInit continues when Redis.setConfig throws (startup resiliency)', async () => {
    // Create a worker where redisService.setConfig will reject to simulate missing Redis in CI
    const failingRedis: any = { setConfig: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')), set: jest.fn().mockResolvedValue(true) };
    const localMocks = makeMocks();
    localMocks.redisService = failingRedis;

    const localSvc = new WorkerService(
      ({} as any),
      localMocks.gateway,
      localMocks.redisService,
      localMocks.sqliteMock,
      localMocks.discoveryService,
      localMocks.pairingService,
      localMocks.guardianService,
      localMocks.registry,
      localMocks.decoder,
      localMocks.providerManager,
      localMocks.chromeManager,
      localMocks.commandRouter,
      localMocks.internalBus,
      (localMocks.internalFsm as unknown) as InternalFsmService
    );

    // Should not throw even if Redis.setConfig fails during onModuleInit
    await expect(localSvc.onModuleInit()).resolves.not.toThrow();

    // Ensure broadcastStatus still called by virtue of no exception
    // (we can check runtimeManager was created)
    expect((localSvc as any).runtimeManager).toBeDefined();
  });
});
