ARBITRAGE SYSTEM MASTER CONTEXT — E:\NEWTOOL

Version: 3.3
Status: ENFORCED
Authority Level: ABSOLUTE
Scope: Desktop Browser Edition — Single Instance Deterministic Engine

1️⃣ SYSTEM PURPOSE

Build a deterministic, isolation-enforced, production-safe desktop arbitrage engine with:

Strict Account Isolation

Single Tab per Account

Provider Contract Filtering

Atomic Dual-Leg Execution

Automatic Hedge Protocol

Exposure Cap Enforcement

Mandatory Execution Audit Trail

CI Safe Mode Stability

No architectural drift allowed.

2️⃣ NON-NEGOTIABLE CONSTITUTION

The system MUST:

Maintain strict AccountContext isolation.

Allow only one active Chrome tab per account.

Require provider contract before processing traffic.

Enforce atomic arbitrage execution.

Trigger hedge protocol on partial failure.

Enforce exposure limits before execution.

Write audit record before any betting occurs.

Prevent duplicate execution of same match.

Never crash runtime process.

Mock Chrome/CDP in CI/test mode.

Avoid global mutable state outside controlled context.

Never generate synthetic fallback event IDs.

Violation of any rule = architecture breach.

3️⃣ ACCOUNT ISOLATION MODEL

Each account owns:

AccountContext {
	accountId
	chromeProfilePath
	cdpConnection
	fsmState
	providerContract
	providerStatus
	oddsStreamActive
	lastTrafficAt
	exposureTracker
}


Cross-account contamination is forbidden.

No shared parser cache.
No shared execution state.

4️⃣ FSM LAW

Valid transitions only:

IDLE
→ STARTING
→ WAIT_PROVIDER
→ ACTIVE
→ STOPPING
→ IDLE


Invalid transitions must be rejected.

FSM must never remain stuck in STARTING.

5️⃣ PROVIDER CONTRACT LAW

Must be user-marked.

Must be persisted in SQLite.

Must match endpointPattern.

Only one active contract per account (Phase 1).

Traffic not matching contract must be ignored.

No hardcoded URLs allowed.

6️⃣ ATOMIC EXECUTION LAW (NEW)

Execution must follow:

Acquire execution lock (per match).

Write audit row to DB.

Validate exposure limits.

Execute Leg A.

Execute Leg B only if Leg A succeeded.

Trigger hedge if Leg B fails or times out.

Update audit record.

Release lock.

Partial execution without hedge = forbidden.

7️⃣ HEDGE PROTOCOL LAW

If:

Leg A success

Leg B failure/timeout

System must:

executeHedge()
persist hedge_event
update audit row


Hedge protocol must never be skipped.

8️⃣ EXPOSURE CONTROL LAW

System must enforce:

MAX_EXPOSURE_PER_MATCH
MAX_TOTAL_EXPOSURE


Before execution.

Exposure tracking is per-account.

If exposure exceeded:
Execution rejected.

CI/test mode may bypass exposure check.

9️⃣ EXECUTION AUDIT LAW

No execution allowed without audit persistence.

SQLite tables:

execution_audit_log

hedge_events

provider_contracts

Audit row must exist BEFORE execution begins.

Audit row must be updated AFTER execution completes.

🔟 DOUBLE-RUN PROTECTION

System must prevent:

Same match executing concurrently.

Duplicate execution of same opportunity.

Per-match execution lock required.

1️⃣1️⃣ ENGINE WATCHDOG LAW

Production mode only:

Every 5 seconds:

Detect stale execution locks

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