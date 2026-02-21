🏛 MASTER CONTEXT — MINIMAL STABLE ENGINE
Version: 5.0
Architecture Model: Frontend-Driven Contract
Status: Authoritative & Locked
1️⃣ SYSTEM PURPOSE

Deterministic Desktop Arbitrage Engine
Scope: 2 Accounts (A vs B)
Target: Single-instance production safe

System guarantees:

Strict account isolation

Deterministic FSM transitions

Single backend runtime brain

No hidden retry logic

No automatic recovery

No dual backend architecture

Frontend-defined state contract

2️⃣ ARCHITECTURE (LOCKED)
✅ Single Backend: NestJS ONLY

FastAPI constitutionally removed.

Ports:

Backend: 3001

Chrome Remote Debug: 9222

Frontend: 3000

No second backend allowed.

Runtime Topology
React UI (3000)
        ↓ REST / WS
NestJS Engine (3001)
        ↓
EngineService (Adapter Layer)
        ↓
WorkerService (FSM Brain)
        ↓
BrowserAutomationService (CDP 9222)
        ↓
Chrome Instance (1 profile per account)
        ↓
Extension (Provider marking + stream)
Authority Model

WorkerService = runtime brain

EngineService = adapter to UI contract

Frontend = authoritative state contract definition

Single runtime memory state lives in NestJS.
Single state shape definition lives in frontend types.

3️⃣ FRONTEND-DRIVEN CONTRACT LAW (NEW)
BackendState in frontend/types.ts is authoritative.

Backend must conform to the exact state shape defined by UI.

Rules:

EngineService.getState() MUST return exactly BackendState.

No client-side transformation layer allowed.

No legacy compatibility mapping allowed.

Only one WebSocket event allowed: backend_state.

REST payload fields must match frontend naming exactly.

If UI changes shape → backend must adapt.

Frontend owns contract.
Backend owns execution logic.

4️⃣ CORE SERVICES
WorkerService

Holds:

accounts = {
  A: AccountRuntime,
  B: AccountRuntime
}

Single orchestrator brain.

No global mutable cross-account state.

No provider registry.
No pairing engine.
No discovery layer.

EngineService

Acts as:

Adapter between Worker runtime and BackendState contract.

Controller for toggle and stream transitions.

Gateway bridge.

EngineService may NOT:

Hold runtime state independently.

Bypass WorkerService.

Maintain shadow state.

BrowserAutomationService

Only two public APIs allowed:

openBrowser(accountId, url)
closeBrowser(accountId)

No retries.
No implicit spawn.
No auto relaunch.
No background loop.

Extension Contract

Extension may only emit:

PROVIDER_MARKED(accountId)
STREAM_PACKET(accountId)

Extension may NOT:

Modify backend state directly

Control FSM

Trigger arbitrage

5️⃣ ACCOUNT RUNTIME (LOCKED STRUCTURE)
AccountRuntime {
  accountId: 'A' | 'B'
  state: IDLE | STARTING | WAIT_PROVIDER | ACTIVE | STOPPING
  url: string | null
  browserSession: object | null
  providerMarked: boolean
  streamActive: boolean
  ping: number | null
}

No extra flags allowed.
No legacy states allowed.

6️⃣ FSM LAW (NON-NEGOTIABLE)

Valid transitions only:

IDLE → STARTING
STARTING → WAIT_PROVIDER
WAIT_PROVIDER → ACTIVE
ACTIVE → STOPPING
STOPPING → IDLE

Invalid transitions:

Rejected

system_log emitted

FSM must never remain in STARTING.

No hidden transitions allowed.

7️⃣ TOGGLE LAW
Toggle ON

Direct actions only:

state = STARTING
openBrowser()
→ WAIT_PROVIDER

No retries.
No background guards.
No event tokens.

Provider must be explicitly marked.

Provider Marked

When extension emits:

PROVIDER_MARKED(accountId)

→ state remains WAIT_PROVIDER
→ waiting for first stream packet

First Stream Packet
STREAM_PACKET(accountId)

→ state = ACTIVE

Toggle OFF (Hard Reset Law)

Must:

closeBrowser()

clear providerMarked

clear streamActive

clear session

state → IDLE

No partial reset allowed.

8️⃣ ENGINE GATING LAW

Arbitrage Engine may run only if:

Account A state == ACTIVE
Account B state == ACTIVE

No exception.

9️⃣ STORAGE LAW

SQLite mandatory for:

execution_history

hedge_events

Provider contracts optional in Phase-1.

Redis:

Optional

Not required for boot

Not required for audit

System must boot without Redis.

🔟 CI SAFE MODE LAW

When:

CI=true
OR
NODE_ENV=test

System must:

Mock ChromeLauncher

Mock CDP attach

No 9222 probe

No real WebSocket

No process.exit()

No watchdog

No external side-effects

CI must be deterministic.

1️⃣1️⃣ FRONTEND AUTHORITY LAW (UPDATED)

Frontend:

Defines BackendState

Controls toggle flow

Renders state

Frontend may NOT:

Execute arbitrage logic

Parse provider traffic

Maintain hidden fallback state

Reconstruct backend state

No transformation layer allowed in frontend.

1️⃣2️⃣ ERROR HANDLING LAW

All fatal conditions must:

Emit structured system_log

Reset FSM safely

Never crash process

No uncaught promise rejection

1️⃣3️⃣ WHAT IS REMOVED FOREVER

Dual backend (FastAPI removed)

Token-based FSM

Compatibility ping wrappers

Dual naming conventions

Automatic retry loops

Background self-healing

Multi-provider per account (Phase 1 forbidden)

Client-side state transformation layer

1️⃣4️⃣ PHASE STATUS

Phase 1 = Minimal Stable Engine
Scope:

1 provider per account

2 accounts total

Deterministic manual workflow

Single instance only

Status: Constitutionally Locked.

1️⃣5️⃣ FUTURE PHASE (NOT ACTIVE)

Multi-provider per account

Distributed lock manager

Capital allocation engine

Multi-instance coordination

Not part of current engine.

1️⃣6️⃣ CURRENT SYSTEM STATUS
Component	Status
Account Isolation	ENFORCED
FSM Determinism	ENFORCED
Frontend Contract	AUTHORITATIVE
Adapter Layer	ENFORCED
Dual Backend	ELIMINATED
Legacy State Mapping	ELIMINATED
CI Safe Mode	ACTIVE
Global State Leak	ELIMINATED

System is deterministic and production-safe (single instance).

🏛 FINAL CONSTITUTIONAL CLAUSE

Any deviation from this document requires:

Explicit amendment

Version bump

Migration note

No silent architectural change allowed.npm error Missing script: "start"