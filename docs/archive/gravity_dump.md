# 🌌 Gravity System Dump (v3.1)

Architecture inventory and state map.

## 📁 1. Daftar File Backend (src/)

- **Core**: `main.ts`, `app.module.ts`, `gateway.module.ts`
- **Workers Area**:
  - `workers/worker.service.ts` (Orchestrator)
  - `workers/api-worker.ts` (AFB88 & CMD368 Logic)
  - `workers/contract-registry.service.ts` (Session Store)
  - `workers/browser.automation.ts` (OS Orchestration)
- **Discovery & Pairing**:
  - `discovery/discovery.service.ts` (Match Registry)
  - `pairing/pairing.service.ts` (Arbitrage Engine)
- **Support Layer**:
  - `guardian/provider-guardian.service.ts` (Health/Lamp Status)
  - `normalization/normalization.service.ts` (Odds standardizer)
  - `recovery/provider.recovery.ts` (Auto-healing)
  - `shared/redis.service.ts` (Persistence)

## 📡 2. Daftar Event Socket (Wire v3.1)

### 📥 Inbound (From UI / Extension)
- `command`: 
  - `TOGGLE_ACCOUNT`: Aktifkan/Matikan slot.
  - `OPEN_BROWSER`: Buka target URL.
  - `UPDATE_CONFIG`: Ubah setting global.
  - `GET_STATUS`: Request snapshot state.
- `endpoint_captured`:
  - `session_capture`: Data login/cookies.
  - `api_contract_capture`: Signatur request.
  - `heartbeat`: Tab connectivity check.
- `ping`: Latency check.

### 📤 Outbound (To UI / Extension)
- `system_status`: Update balance & lamp color.
- `scanner:update`: Data arbitrage real-time.
- `browser:open`: Perintah buka tab ke Extension.
- `browser:reload`: Refresh tab bermasalah.
- `sniffer:reinject`: Suntik ulang hook network.
- `config:updated`: Broadcast perubahan setting.

## 🏗️ 3. Daftar Service Nest

- **HealthMonitor**: Watchdog stabilitas sistem.
- **WorkerService**: Manajemen siklus hidup provider.
- **DiscoveryService**: Pusat data match dari semua sumber.
- **PairingService**: Algoritma pencarian profit.
- **ProviderGuardian**: Penentu status lampu (LIVE/DEAD).
- **BrowserAutomation**: Jembatan Backend <-> OS Shell.

## 🤖 4. Daftar Worker & Registry

- **Workers**:
  - `AfbWorker`: Spesialis AFB88 (Deep parsing Socket.io).
  - `CmdWorker`: Spesialis CMD368/ISPORT.
- **Registries**:
  - `ContractRegistry`: Menyimpan Session, Cookies, dan UA.
  - `MatchRegistry`: (Dalam Discovery) Menyimpan ribuan odds aktif.
  - `PairRegistry`: Menyimpan pasangan match A vs B yang valid.

## 🧩 5. Daftar Script Extension

- `manifest.json`: Definisi permissions & host permissions.
- `background.js`: Core extension, Socket.io client, Cookie manager.
- `content.js`: Relay pesan dari halaman web ke background.
- `injected.js`: Network hooks (XHR/Fetch/WS) untuk capture traffic.
- `popup.js`: UI sederhana untuk status koneksi.
