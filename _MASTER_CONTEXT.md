Minimal Stable Engine — Master Context

Version: 1.0
Scope: Minimal Stable Arbitrage Engine (2 accounts)

System Philosophy
- Simplicity > Complexity
- Deterministic, explicit transitions only
- User-driven actions (no automatic retries or hidden guards)

Core Components
- `WorkerService`: single orchestrator holding `accounts` runtime state for `A` and `B`.
- `BrowserAutomationService`: executor with two APIs: `openBrowser(account,url)` and `closeBrowser(account)`.
- `Extension`: performs provider marking via `PROVIDER_MARKED(accountId)`.
- `Stream detection`: first stream packet advances account to `RUNNING`.

AccountRuntime
- `accountId`: 'A' | 'B'
- `state`: one of `IDLE | BROWSER_OPENING | BROWSER_READY | PROVIDER_READY | RUNNING | STOPPING`
- `url`: configured whitelabel URL or null
- `browserSession`: opaque session object or null
- `providerMarked`: boolean
- `streamActive`: boolean

Operational Rules
- Toggle ON: direct call to `BrowserAutomationService.openBrowser`; no retries, no event token.
- Provider must be explicitly marked by extension (`PROVIDER_MARKED`).
- First stream packet moves account to `RUNNING` and starts observer.
- Toggle OFF: direct close via `BrowserAutomationService.closeBrowser` and reset runtime state.

No automatic recovery, no internal token-based FSM, and no complex event orchestration.

After refactor: build, start backend, test workflow for each account manually.

Detect execution timeout violation

Release stale locks

Emit system_log

CI/test mode:
Watchdog disabled.

1️⃣2️⃣ CI SAFE MODE LAW

When:

CI=true
OR
NODE_ENV=test


System must:

Mock ChromeLauncher

Mock CDP session

Avoid localhost:9222 HTTP probe

Avoid real WebSocket connect

Bypass exposure caps

Disable watchdog

Never call process.exit()

CI must be deterministic.

1️⃣3️⃣ STORAGE LAW

SQLite is mandatory for:

Provider contracts

Execution audit

Hedge events

Redis:

Optional performance layer

Not required for boot

Not required for audit

System must boot without Redis.

1️⃣4️⃣ FRONTEND PURITY LAW

Frontend may:

Render state

Send commands

Frontend may NOT:

Execute provider parsing

Execute arbitrage logic

Maintain global business state

All logic belongs to backend.

1️⃣5️⃣ ERROR HANDLING LAW

All fatal conditions must:

Emit structured system_log

Safely reset FSM if needed

Release execution locks

Never crash process

Uncaught promise rejection forbidden.

1️⃣6️⃣ CURRENT SYSTEM STATUS
Component	Status
Account Isolation	ENFORCED
Provider Contract	ENFORCED
Atomic Execution	ENFORCED
Hedge Protocol	ACTIVE
Exposure Caps	ACTIVE
Audit Logging	MANDATORY
Double-Run Protection	ACTIVE
Watchdog	ACTIVE (Prod only)
CI Safe Mode	ACTIVE
Global State Leak	ELIMINATED

System is production-safe for single-instance deployment.

1️⃣7️⃣ PHASE STATUS

Phase 1 = COMPLETE
Architecture hardened.
Deterministic execution enforced.
CI stable.

Next phase (optional future):

Multi-instance exposure coordination

Distributed lock manager

Risk model tuning

Capital allocation engine

END OF MASTER CONTEXT v3.3
Authoritative.
Any deviation requires explicit constitutional amendment.

---

# 1️⃣ SYSTEM PURPOSE

Deterministic Desktop Arbitrage Engine with:

- Strict Account Isolation
- Provider Contract Filtering
- Single Tab per Account
- CI Safe Mode
- No Synthetic ID Fallback

This document is authoritative. All implementation must comply.

---

# 2️⃣ CONSTITUTION RULES (NON-NEGOTIABLE)

1. One Chrome profile per account.
2. One active tab per account.
3. Provider contract required before processing odds.
4. No fallback ID generation.
5. No global mutable state.
6. No Chrome spawn in CI mode.
7. No process.exit() on runtime failure.
8. All failures emit `system_log`.

---

# 3️⃣ ACCOUNT ISOLATION ARCHITECTURE

Each account maintains:

- Independent FSM
- Independent Chrome instance
- Independent provider contract
- Independent status lamp
- Independent odds cache

Cross-contamination forbidden.

---

# 4️⃣ PROVIDER CONTRACT LAW

Provider contract must:

- Be user-marked
- Be persisted
- Match traffic pattern
- Block all unmatched traffic

Multiple contracts per account (Phase 1) = FORBIDDEN.

---

# 5️⃣ FSM ENFORCEMENT

Valid transitions only:

IDLE → STARTING → WAIT_PROVIDER → ACTIVE → STOPPING → IDLE

Invalid transitions must be rejected.

FSM must never remain stuck in STARTING.

---

# 6️⃣ CI SAFE MODE CONSTITUTION

When CI/test:

- ChromeLauncher returns mock
- CDP attach returns mock
- No HTTP probe to port 9222
- No real WebSocket
- No external side-effects

System must pass CI even without Chrome installed.

---

# 7️⃣ ENGINE GATING LAW

Arbitrage Engine may run only if:

- Account A providerStatus = GREEN
- Account B providerStatus = GREEN
- Engine state = RUNNING

No exception.

---

# 8️⃣ STORAGE LAW

SQLite:
- provider_contracts
- execution_history

Redis:
- Performance layer only
- Not required for boot

---

# 9️⃣ FRONTEND PURITY RULE

Frontend may:

- Render state
- Send commands

Frontend may NOT:

- Contain provider parsing
- Execute arbitrage logic
- Maintain global business state

---

# 🔟 HARD RESET RULE

Toggle OFF must:

- Close tab
- Detach CDP
- Clear provider contract
- Clear odds cache
- Set providerStatus = RED
- FSM → IDLE

No partial reset allowed.

---

# 11️⃣ ERROR HANDLING LAW

All fatal conditions must:

- Emit structured system_log
- Reset FSM safely
- Never crash process

---

# 12️⃣ CURRENT IMPLEMENTATION STATUS

- AccountContext Isolation: ACTIVE
- CI Safe Mode: ACTIVE
- Provider Contract System: ACTIVE
- AdminPanel Persistence: ACTIVE
- Chrome/CDP Guard: ACTIVE

System is deterministic and CI-stable.

---

END OF MASTER CONTEXT