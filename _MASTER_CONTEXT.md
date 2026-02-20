🏛 MASTER CONTEXT — MINIMAL STABLE ENGINE

Version: 4.0 (Authoritative Constitution)
Status: FINAL & LOCKED

1️⃣ SYSTEM PURPOSE

Deterministic Desktop Arbitrage Engine
Scope: 2 Accounts (A vs B)
Target: Single-instance production safe

System guarantees:

Strict account isolation

Deterministic transitions

Single backend brain

No hidden retry logic

No automatic recovery

No dual backend architecture

2️⃣ ARCHITECTURE (LOCKED)
✅ Single Backend: NestJS ONLY

FastAPI is constitutionally removed.

Ports:

Backend: 3001

Chrome Remote Debug: 9222

Frontend: 3000

No second backend allowed.

Runtime Topology
React UI (3000)
     ↓ REST / WS
NestJS Orchestrator (3001)
     ↓
WorkerService (FSM per account)
     ↓
BrowserAutomationService (CDP 9222)
     ↓
Chrome Instance (1 profile per account)
     ↓
Extension (Provider marking + stream)

Single source of truth = NestJS memory state.

3️⃣ CORE SERVICES
WorkerService

Holds:

accounts = {
  A: AccountRuntime,
  B: AccountRuntime
}

Single orchestrator brain.
No global mutable cross-account state.

BrowserAutomationService

Only two public APIs allowed:

openBrowser(accountId, url)
closeBrowser(accountId)

No retries.
No implicit spawn.
No auto relaunch.

Extension Contract

Extension may only:

Emit:

PROVIDER_MARKED(accountId)

STREAM_PACKET(accountId, data)

Extension may NOT:

Control FSM

Trigger arbitrage

Modify backend state directly

4️⃣ ACCOUNT RUNTIME (LOCKED STRUCTURE)
AccountRuntime {
  accountId: 'A' | 'B'
  state: IDLE | STARTING | WAIT_PROVIDER | ACTIVE | STOPPING
  url: string | null
  browserSession: object | null
  providerMarked: boolean
  streamActive: boolean
}

No extra flags allowed.
No legacy states allowed.

5️⃣ FSM LAW (NON-NEGOTIABLE)

Valid transitions only:

IDLE → STARTING
STARTING → WAIT_PROVIDER
WAIT_PROVIDER → ACTIVE
ACTIVE → STOPPING
STOPPING → IDLE

Invalid transitions = rejected + system_log.

FSM must never remain in STARTING.

No hidden transitions allowed.

6️⃣ TOGGLE LAW
Toggle ON

Direct actions only:

state = STARTING
openBrowser()
→ WAIT_PROVIDER

No retries.
No event tokens.
No background guards.

Provider must be marked explicitly.

Provider Marked

When extension emits:

PROVIDER_MARKED(accountId)

→ state remains WAIT_PROVIDER
→ waiting for first stream packet

First Stream Packet
STREAM_PACKET(accountId)

→ state = ACTIVE
→ observer starts

Toggle OFF (Hard Reset Law)

Must:

closeBrowser()

clear providerMarked

clear streamActive

clear session

state → IDLE

No partial reset allowed.

7️⃣ ENGINE GATING LAW

Arbitrage Engine may run only if:

Account A state == ACTIVE
Account B state == ACTIVE

No exception.

8️⃣ STORAGE LAW (LOCKED)

SQLite mandatory for:

provider_contracts

execution_history

hedge_events

Redis:

Optional

Not required for boot

Not required for audit

System must boot without Redis.

9️⃣ CI SAFE MODE LAW

When:

CI=true
OR
NODE_ENV=test

System must:

Mock ChromeLauncher

Mock CDP attach

No 9222 HTTP probe

No real WebSocket

No process.exit()

No watchdog

No external side-effects

CI must be deterministic.

🔟 FRONTEND PURITY LAW

Frontend may:

Render backend state

Send toggle / commands

Frontend may NOT:

Execute arbitrage logic

Parse provider traffic

Maintain business state

Create fallback state

Backend = single authority.

11️⃣ ERROR HANDLING LAW

All fatal conditions must:

Emit structured system_log

Reset FSM safely

Release execution locks

Never crash process

No uncaught promise rejection

12️⃣ WHAT IS REMOVED FOREVER

Dual backend (FastAPI removed)

Token-based FSM

Compatibility ping wrappers

Dual naming (primary_ping_ms vs accountA_ping)

Automatic retry loops

Background self-healing

Multi-provider per account (Phase 1 forbidden)

13️⃣ PHASE STATUS

Phase 1 = Minimal Stable Engine
Scope:

1 provider per account

2 accounts total

Deterministic manual workflow

No distributed coordination

Status: Constitutionally Locked.

14️⃣ FUTURE PHASE (NOT ACTIVE)

Multi-provider per account

Distributed lock manager

Capital allocation engine

Multi-instance coordination

Not part of current engine.

15️⃣ CURRENT SYSTEM STATUS
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

System is deterministic and production-safe (single instance).

FINAL CONSTITUTIONAL CLAUSE

Any deviation from this document requires:

Explicit amendment

Version bump

Migration note

No silent architectural change allowed.