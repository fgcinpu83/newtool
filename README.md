# 🦅 ANTIGRAVITY v3.2 — DESKTOP BROWSER EDITION

**Deterministic Multi-Account Arbitrage Engine**  
Single-Tab Isolation | Provider Contract System | CI-Safe Architecture

---

## 🎯 SYSTEM OBJECTIVE

Build a deterministic desktop arbitrage system that:

- Captures provider odds via Chrome Extension (passive interception)
- Isolates each betting account in its own Chrome profile + tab
- Enforces strict provider contract filtering
- Runs arbitrage only when both providers are ACTIVE
- Never crashes under CI or runtime instability

This system prioritizes:
- Isolation
- Determinism
- Fail-Safe behavior
- Test stability

---

# 🏗️ CURRENT ARCHITECTURE (PHASE 1 COMPLETE)

## Core Principles

1. **Single Tab Per Account**
2. **Dedicated Chrome Profile Per Account**
3. **Strict FSM Per Account**
4. **Provider Contract Required Before Processing**
5. **No Hardcoded Whitelabel URLs**
6. **CI Safe Mode (No Real Chrome in CI)**

---

# 🧠 Account Isolation Model

Each account has its own runtime context:

AccountContext {
accountId: 'A' | 'B'
url
chromeProfilePath
cdpConnection
fsmState
providerContract
providerStatus (RED | YELLOW | GREEN)
oddsStreamActive
lastTrafficAt
}


No shared state between A and B.

---

# 🔄 Account FSM

IDLE
→ STARTING
→ WAIT_PROVIDER
→ ACTIVE
→ STOPPING
→ IDLE


Rules:

- Toggle ON does NOT start arbitrage engine.
- Provider must be marked first.
- Toggle OFF performs full hard reset.

---

# 🧾 Provider Contract System

Provider contract is:

- User-marked from extension popup
- Persisted in SQLite (`provider_contracts`)
- Bound to specific AccountContext
- Used for strict traffic filtering

Only traffic matching:

endpointPattern
method
requestSchema
responseSchema


is processed.

No contract → no odds processing.

---

# 🟢 Provider Status Lifecycle

GREEN:
- Valid traffic flowing
- Contract exists
- Parsing success

YELLOW:
- No valid traffic for 5s

RED:
- No contract
- CDP disconnected
- FSM not ACTIVE

---

# 🚀 Arbitrage Engine Gating

Engine can RUN only when:

- Account A providerStatus = GREEN
- Account B providerStatus = GREEN
- Engine state = RUNNING

Engine does not auto-start on Toggle ON.

---

# 🧪 CI SAFE MODE (CRITICAL)

When:

process.env.CI === true
OR
NODE_ENV === 'test'


System behavior changes:

- No real Chrome spawn
- No real CDP attach
- All Chrome/CDP operations mocked
- No process.exit(1)
- All errors emit `system_log` only

This guarantees deterministic CI.

---

# 💾 Persistence Layer

SQLite:
- provider_contracts
- execution_history

Redis:
- Optional performance cache layer
- Not required for system boot

---

# 🖥️ Admin Panel

Admin UI allows:

- List provider contracts
- Delete provider contracts
- View execution history (DB)
- Refresh persisted state

Frontend contains no business logic.

---

# 🔒 Constitution Rules (Enforced)

- No global mutable state
- No synthetic fallback IDs
- No provider logic in UI
- No multi-tab per account
- No hardcoded provider URLs
- No Chrome spawn in CI mode
- No unhandled promise rejections

---

# 🧪 Smoke Validation Checklist

Toggle ON:
- Chrome opens single tab
- FSM → WAIT_PROVIDER

Mark Provider:
- Contract saved in DB
- providerStatus → GREEN when traffic flows

Toggle OFF:
- Tab closed
- CDP detached

---

## 🔐 Phase 1 — Execution Hardening (new)

This release adds execution safety controls for the backend only (Phase 1 hardening).

- New environment variables (set as needed):
	- `EXECUTION_TIMEOUT_MS` — per-leg timeout in milliseconds (default: `30000`).
	- `MAX_EXPOSURE_PER_MATCH` — maximum stake per match per account in production (default: `1000`).
	- `MAX_TOTAL_EXPOSURE` — total maximum outstanding exposure per account in production (default: `5000`).

	Notes: exposure checks and the engine watchdog are bypassed in CI/test (when `process.env.CI === 'true'` or `NODE_ENV === 'test'`).

- SQLite additions/migration (auto-run on service start):
	- New table `execution_audit_log` with columns:
		- `id`, `timestamp`, `matchId`, `providerA`, `providerB`, `stakeA`, `stakeB`, `legA_status`, `legB_status`, `hedge_triggered`, `final_status`, `error_message`.
	- New table `hedge_events` with columns: `id`, `timestamp`, `auditId`, `details`.
	- Migration: `SqliteService.migrate()` will create tables and attempt to add missing columns safely on startup. The database file is by default at `<repo-root>/data/ag.sqlite`.

- Behavior guarantees:
	- Every execution attempt writes an audit row before any betting occurs; the engine aborts if the audit write fails (prevents un-audited runs).
	- Leg B will NOT run if Leg A fails.
	- If Leg A succeeds but Leg B fails (including timeout), a hedge attempt is triggered and persisted.
	- A per-process execution lock prevents double-running the same match. For multi-instance deployments, replace the in-memory exposure/lock with a shared store (Redis) if required.

Usage examples (Docker / env):

```powershell
# Build image (example)
docker build -t newtool-backend:local -f Dockerfile .

# Run with custom timeouts / exposure limits
docker run --rm -e EXECUTION_TIMEOUT_MS=40000 -e MAX_EXPOSURE_PER_MATCH=2000 -e MAX_TOTAL_EXPOSURE=8000 newtool-backend:local
```

If you need a multi-process-safe exposure store or to export audit data, I can add a Redis-backed implementation and a small query tool next.

---

🔒 Phase 1 Execution Hardening (v3.2)

This version introduces strict atomic execution, hedge protection, exposure caps, and mandatory audit logging.

⚙️ Environment Variables (Execution Safety)

You can configure execution behavior via environment variables:

```
EXECUTION_TIMEOUT_MS=30000          # Per-leg execution timeout (default: 30000ms)
MAX_EXPOSURE_PER_MATCH=1000         # Max exposure per match (per account)
MAX_TOTAL_EXPOSURE=5000             # Max total exposure per account (process memory)
```

Notes:

Exposure caps are enforced before execution.

In CI / test mode, exposure checks are bypassed.

If exposure exceeds limits, execution is rejected safely (no partial betting).

Timeouts trigger automatic hedge protocol if needed.

🧾 Execution Audit Logging (Mandatory)

Every arbitrage attempt now creates an audit record before any leg is executed.

SQLite Tables:

`execution_audit_log`

Field	Description
id	Primary key
timestamp	Execution start time
matchId	Canonical match ID
providerA	Provider A name
providerB	Provider B name
stakeA	Stake placed on A
stakeB	Stake placed on B
legA_status	success / failed / timeout
legB_status	success / failed / timeout
hedge_triggered	boolean
final_status	success / failed
error_message	nullable

Execution will abort if audit row cannot be written.

No execution is allowed without persistence.

🛡 Hedge Protocol

If:

Leg A succeeds

Leg B fails or times out

System automatically triggers hedge protocol:

`hedge.service.ts` → `executeHedge()`


Hedge events are persisted in:

`hedge_events`

Used for post-mortem analysis and exposure tracking.

🔐 Atomic Execution Model

Execution flow:

Acquire execution lock (per match).

Write audit row.

Validate exposure caps.

Execute Leg A.

Execute Leg B (only if Leg A succeeded).

Trigger hedge if Leg B fails.

Update audit row.

Release lock.

Double execution of same match is prevented.

👁 Engine Watchdog (Production Only)

In production mode:

Every 5 seconds the engine checks for:

Stale execution locks

Timeout violations

Automatically releases stale locks

Emits structured system_log events

Disabled in CI/test mode.

🧪 CI/Test Safety

When:

`CI=true`
or
`NODE_ENV=test`

No real Chrome spawn

No real CDP attach

Exposure limits bypassed

Watchdog disabled

Execution safe-mode active

Ensures deterministic CI.

✅ Phase 1 Status

Account Isolation: Enforced

Provider Contracts: Enforced

Atomic Execution: Enforced

Hedge Protocol: Implemented

Exposure Caps: Active

Audit Logging: Mandatory

CI Safe Mode: Active

Phase 1 = Production Safe (Single Instance).
- Contract cleared
- FSM → IDLE

Admin Panel:
- List contract works
- Delete works
- Execution history visible

---

# 📈 Current System Status

- Provider Isolation: ENFORCED
- CI Self-Stabilizing: ENABLED
- AccountContext Isolation: ACTIVE
- Admin Persistence: ACTIVE
- No Global State Leaks: VERIFIED

---

# ⚠️ Operational Notes

Production Mode:
- Real Chrome spawn enabled
- Real CDP attach
- Real provider traffic

CI/Test Mode:
- Chrome/CDP mocked
- No port binding
- Deterministic tests only

---

Version: 3.2  
Architecture Status: Phase 1 Complete  
Last Updated: 2026-02-14