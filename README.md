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