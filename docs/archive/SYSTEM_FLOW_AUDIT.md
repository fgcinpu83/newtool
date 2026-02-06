# Total System Flow Audit: Provider Data Chain & Status Logic

**Date:** 2023-10-27
**Objective:** End-to-end audit of the data chain from UI to Backend and back to UI, specifically focusing on Provider Status ("Lamps") integrity.

---

## 1. Real System Flow Map

This table traces the lifecycle of a data packet from the moment it hits the system to when the UI updates.

| Stage | Component | File | Method/Function | Action / Logic | Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Trigger** | **Gateway** | `gateway.module.ts` | `handleEndpointCaptured` | Receives raw payload from Sniffer/Worker. Logs event to `wire_debug.log`. | Emits `endpoint_captured` to internal EventBus. |
| **2. Ingest** | **Worker** | `worker.service.ts` | `handleEndpointCaptured` | **CRITICAL LOGIC FIX**: <br>- `IS_ODDS`? Check `data.data` length. If valid -> `LIVE`. <br>- `IS_SESSION`? If `INACTIVE` -> `HEARTBEAT_ONLY`. | Updates `providerRegistry` state. Calls `broadcastStatus`. |
| **3. Monitor** | **Guardian** | `provider-guardian.service.ts` | `processIngest` | Updates internal `GuardianState`. Tracks last seen times. Enforces timeouts (30s). | Degrades `LIVE` to `HEARTBEAT_ONLY` on timeout. |
| **4. Stats** | **Discovery** | `discovery.service.ts` | `registerMatch` | Increments `flowStats` (odds events count). | Updates `flowStats` rate & delta. |
| **5. Sync** | **Worker** | `worker.service.ts` | `broadcastStatus` | **AGGREGATION**: <br>1. Get `GuardianState` (Liveness). <br>2. Get `DiscoveryState` (Stability). <br>3. **Rule**: `LIVE` requires Guardian `LIVE` AND Discovery Stable. | Derives final `ProviderState`. |
| **6. Output** | **Gateway** | `gateway.module.ts` | `sendUpdate('system_status')` | Transmits aggregated status object to all connected UI clients. | WebSocket Event: `system_status`. |
| **7. Display** | **Frontend** | `page.tsx` | `socket.on('system_status')` | **VISUAL MAPPING**: <br>- `LIVE` → **GREEN**. <br>- `HEARTBEAT_ONLY/SESSION_BOUND` → **YELLOW**. <br>- `DEAD/ERROR` → **RED**. | Renders colored Lamp. |

---

## 2. Audit of Status Sources

All locations that touch Provider Status.

| Component | File | Impact | Status |
| :--- | :--- | :--- | :--- |
| **Worker Service** | `worker.service.ts` | **AUTHORITY**. Defines the `providerStatus` map sent to UI. Contains the logic for "Green Light" promotion. | **VERIFIED & PATCHED** |
| **Provider Guardian** | `guardian/provider-guardian.service.ts` | **MONITOR**. Enforces timeouts. The "Watchdog" that degrades status if data stops. | **VERIFIED** |
| **Discovery Service** | `discovery.service.ts` | **VALIDATOR**. Provides flow rates to prevent "Fake Green" if data is trickling but not real. | **VERIFIED** |
| **Health Monitor** | `health/health.monitor.ts` | **SYSTEM VIEW**. Uses provider status to determine *Pipeline* health, but does not set provider lamps. | **SAFE** (Read-only) |
| **Gateway** | `gateway.module.ts` | **TRANSPORT**. Dumb pipe. No logic, just logs and emits. | **SAFE** |

---

## 3. Real State Contract (The Truth)

There is now a **Single Source of Truth** for the UI Lamps: `WorkerService.providerStatus`.

**State Definitions:**
1.  **INACTIVE (Grey)**:
    *   *Condition*: Provider slot is empty or explicitly reset/toggled OFF.
    *   *Meaning*: System is not trying to connect.
2.  **DEAD (Red)**:
    *   *Condition*: `Guardian` reports `DEAD` (Timeout > 1h) or `ERROR`.
    *   *Meaning*: Critical failure, requires intervention.
3.  **HEARTBEAT_ONLY (Yellow)**:
    *   *Condition*: Session exists (`init`, `balance`, `heartbeat`) BUT `odds` data is empty (`length == 0`) OR `Guardian` timed out (`>30s` since last odds).
    *   *Meaning*: "I am logged in and listening, but the sports page is not sending data."
4.  **RECOVERING (Orange)**:
    *   *Condition*: `reinject` or reload command is verified active.
    *   *Meaning*: System is attempting self-repair.
5.  **LIVE (Green)**:
    *   *Condition*:
        *   `Guardian` says `LIVE` (Odds received < 30s ago).
        *   **AND** `Worker` verifies `data.data.length > 0`.
        *   **AND** `Discovery` verifies flow rate is stable.
    *   *Meaning*: "Real Odds are entering the engine right now."

---

## 4. Logic Simulation

| Scenario | Input Event | Previous State | New State | UI Color | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Start** | Toggle ON | `INACTIVE` | `HEARTBEAT_ONLY` (initially) | **YELLOW** | Worker registration defaults to wait-for-data. |
| **Login** | `init / balance` | `HEARTBEAT_ONLY` | `HEARTBEAT_ONLY` | **YELLOW** | Session valid, but no odds yet. |
| **Spin** | `heartbeat` | `HEARTBEAT_ONLY` | `HEARTBEAT_ONLY` | **YELLOW** | Still no odds validation. |
| **Fake Data** | `odds` (empty []) | `HEARTBEAT_ONLY` | `HEARTBEAT_ONLY` | **YELLOW** | **Blocker**: Empty array check prevents promotion. |
| **Real Data** | `odds` (active) | `HEARTBEAT_ONLY` | **LIVE** | **GREEN** | Valid data + Guardian promotion. |
| **Stall** | No Data (31s) | `LIVE` | `HEARTBEAT_ONLY` | **YELLOW** | **Guardian**: Timeout triggers degradation. |

---

## 5. False Logic Eliminated

The following incorrect assumptions have been removed from the codebase:
*   ❌ **"Toggle ON = Green"**: Removed. Toggle now only allows registration; status waits for signal.
*   ❌ **"Login Success = Green"**: Removed. Login only proves session, not data.
*   ❌ **"Any 'odds' event = Green"**: Removed. Empty arrays from sniffers no longer trigger Green.
*   ❌ **"UI guessing colors"**: Removed. Frontend no longer maps `CONNECTED`, `IDLE`, or `SESSION_BOUND` to Green.

## 6. Validation Protocol (Logs to Watch)

**A. Correct "Yellow" State (Login but no Odds):**
Look for: `[WORKER] 🟡 B/CMD368 -> HEARTBEAT_ONLY (Session/Heartbeat Valid)`
*This confirms the backend is holding the status back until proof of data.*

**B. Correct "Green" State (Odds Flowing):**
Look for: `[WORKER] 🟢 B/CMD368 -> LIVE (Odds/Match Batch Valid)`
*This confirms strict promotion only happens on real data.*

**C. Correct "Degradation" (Data Stop):**
Look for: `[GUARDIAN] 🔻 DOWNGRADE B/CMD368: LIVE -> HEARTBEAT_ONLY (Timeout)`
*This confirms the watchdog is active.*
