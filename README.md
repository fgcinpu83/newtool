# Minimal Stable Arbitrage Engine

This repository is refactored to a Minimal Stable Engine architecture for a 2-account arbitrage system.

Goals
- Deterministic, user-driven flows for accounts A and B.
- Simple, explicit state transitions. No internal token guards, retries, or event-driven FSMs.

Architecture
- `WorkerService`: single authoritative service; holds `accounts` state for `A` and `B` (FSM enforced: IDLE | STARTING | WAIT_PROVIDER | ACTIVE | STOPPING).
- `BrowserAutomationService`: executor with two simple APIs: `openBrowser(account,url)` and `closeBrowser(account)`.
- `Extension`: marks provider via `PROVIDER_MARKED` event (WorkerService enforces single-provider-per-account).
- `Stream detection`: first valid stream packet sets `streamActive` and (when providerMarked) transitions account to `ACTIVE`.

State Flow

IDLE → STARTING → WAIT_PROVIDER → ACTIVE → STOPPING → IDLE

(Constitution v4.0 — WorkerService is the single source of truth for AccountRuntime; no non-v4 state names such as READY/EXECUTING/COMPLETED/LOCKED are used.)

User Workflow
- Set `urlA` / `urlB` via config
- Toggle ON (worker opens browser for account)
- Login & mark provider via extension (sends `PROVIDER_MARKED`)
- When first stream packet arrives, account state becomes `RUNNING`
- Toggle OFF closes browser and resets account

Principles
- Simplicity over complexity
- Deterministic transitions only
- No automatic retries, no hidden fallback, and no background auto-recovery (conforms to Master Context v4.0)

See `backend/src/workers/worker.service.ts` and `backend/src/workers/browser.automation.ts` for implementation.

---


## 🧱 Frontend‑Driven State Contract

The UI is now the **single source of truth** for the shape of the `BackendState`
that the server returns.  The `frontend_new/types.ts` file defines this interface
and any changes to state fields *must* be made there first; backend code must
continue to return an object that exactly matches that type (no additional
wrapping or adapter layers).

Key points:

1. `EngineService.getState()` transforms internal `WorkerService` runtime data
   into the frontend contract.  The worker itself remains a private runtime.
2. The `/api/toggle` endpoint now expects `{ account:'A'|'B', active:boolean }`
   (frontend decides the naming).
3. WebSocket updates are emitted on a single channel, `backend_state`.
   The legacy `state_update` channel has been removed.
4. Clients may still poll `/api/system/state` and `/api/logs` as fallbacks;
   the responses return the same shape as the WebSocket payload.

Maintainers must treat the frontend `BackendState` type as an API spec and
coordinate UI/backend changes through normal version control.

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

- Provider Isolation: ENFORCED (single-provider-per-account)
- CI Safe Mode: ENABLED (Chrome/CDP mocked in CI/test)
- FSM (Master Context v4.0): IDLE | STARTING | WAIT_PROVIDER | ACTIVE | STOPPING
- No background auto-recovery or hidden retries
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