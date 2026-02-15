# ARBITRAGE SYSTEM MASTER CONTEXT — E:\NEWTOOL
Authoritative Operational Constitution
Status: ENFORCED
Version: 3.2

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