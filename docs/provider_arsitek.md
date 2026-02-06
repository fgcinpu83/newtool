# provider_arsitek.md — Provider Architecture Registry v1.0

**Status**: 🔒 LOCKED  
**Authority**: Project Lead  
**Scope**: Desktop v3.1 Passive Engine  

## 1. Global Provider Architecture Model

Sistem Gravity Desktop v3.1 menggunakan model profil *extensible*. Setiap provider dikategorikan ke dalam salah satu profil berikut:

| Profil | Transport | Auth Model | Trigger Model | Extension Role | Worker Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AUTO_PUSH** | JSON/WS | Static/Cookie | Auto | Sniffer | Parser |
| **PATH_SESSION** | XHR | S(TOKEN) URL | Login-Bound | Context Capture | Session Parser |
| **EVENT_DRIVEN** | XHR/WS | Dynamic | UI Internal | **UI Activator** | Event Filter |
| **ENCRYPTED** | Binary/WSS | Handshake | Proprietary | Decryptor (Inject) | Raw Parser |
| **WEBSOCKET_STREAM** | WS Binary | Tokenized | Connect | Handshake Proxy | Frame Parser |
| **DOM_RENDERED** | HTML | Session | Scrolled | **Scraper** | Normalizer |

---

## 2. Provider Registry Table

| Provider | Domain Utama | Profil | Transport | Trigger | Odds Endpoint | Status Backend | Status Worker |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AFB88** | mpo / ezc / linkcdn | EVENT_DRIVEN | XHR/WS | UI Interaction | `pgBetOdds` | Passive Ready | AFB Worker |
| **ISPORT** | qq188 / jps9 | PATH_SESSION | XHR JSON | Auto Refresh | `pgMain` / `Data` | Passive Ready | CMD Worker |
| **CMD368** | cmd368 | AUTO_PUSH | JSON API | Auto | `getMatch` / `SportItems`| Passive Ready | CMD Worker |

---

## 3. Provider Detail Sheets

### 🟢 PROVIDER: CMD368 (AUTO_PUSH)
- **Class**: `AUTO_PUSH`
- **Transport**: JSON API
- **Noise**: `Common/Banner`, `Common/Announcement`
- **Substantive**: `SportItems`, `GetSportItems`
- **Birth Rule**: Payload contains `SportItems` array.
- **Extension Role**: Capture only.
- **Worker Role**: Standard CMD parsing (recursive scan).

### 🟡 PROVIDER: ISPORT (PATH_SESSION)
- **Class**: `PATH_SESSION`
- **Transport**: XHR (JSON)
- **Noise**: `Heartbeat`, `CheckSession`
- **Substantive**: `Data`, `Matches`, `GetOdds`
- **Birth Rule**: URL contains `(S(` token.
- **Extension Role**: Capture full session path + cookies.
- **Worker Role**: Extract token from path, parse nested `Data` packets.

### 🔴 PROVIDER: AFB88 (EVENT_DRIVEN)
- **Class**: `EVENT_DRIVEN`
- **Transport**: XHR + WS
- **Noise**: `pgMain` (Heartbeat/Maintenance)
- **Substantive**: `pgBetOdds`
- **Birth Rule**: Payload contains `odds_batch` or `pgBetOdds` signature.
- **Extension Role**: **Activator WAJIB**. Harus klik market untuk memicu `pgBetOdds`.
- **Worker Role**: Filter `pgMain`, parse `pgBetOdds` exclusively.

---

## 4. Architecture Flow Final (v3.1)

Logic resmi yang harus dipatuhi tanpa perkecualian:

**User Trigger (Toggle ON)**  
→ **Backend** (Command Browser Open via UI URL)  
→ **Extension** (Attach context, Detect domain)  
→ **Extension** (If Class: EVENT_DRIVEN → Activate UI Driver)  
→ **Extension** (Capture Network Traffic)  
→ **Gateway** (Passive Receive)  
→ **WorkerService** (Classifier: Match Payload to Registry above)  
→ **Worker** (Parse & Emit)  
→ **Normalization** → **Discovery** → **Guardian** → **Pairing**.

### Hard Reminders:
- **Backend BUKAN Aktor**: Tidak boleh memanggil API sportsbook.
- **Worker BUKAN Harvester**: Tidak boleh polling atau login.
- **Extension SATU-SATUNYA Interactor**: Activator UI hanya ada di extension.

---

## 5. USER TRIGGER RULES & EXTENSION ACTIVATOR SPEC

Section ini mendokumentasikan manual operasional mesin arbitrage. Data flow hanya akan aktif jika trigger UI dieksekusi dengan benar oleh Extension Activator.

### 🎮 USER TRIGGER PROFILE — CMD368 (AUTO_PUSH)
- **A. Default State**: Odds auto-flow setelah halaman sport terbuka.
- **B. Required User Triggers**: Open Sportsbook page.
- **C. Substantive Signal**: `SportItems` atau `getMatch`.
- **D. Extension Activator Rules**: Cukup jaga tab tetap aktif. Tidak butuh klik paksa.
- **E. Failure Mode**: Jika data berhenti, refresh halaman via extension command.

### 🎮 USER TRIGGER PROFILE — ISPORT (PATH_SESSION)
- **A. Default State**: Odds auto-flow pada interval tertentu setelah login.
- **B. Required User Triggers**: Navigasi ke halaman Sports.
- **C. Substantive Signal**: `Matches` / `GetOdds`.
- **D. Extension Activator Rules**: Pastikan session path (S(TOKEN)) tertangkap. Tidak butuh klik activator.
- **E. Failure Mode**: Jika 401/Unauthorized, extension harus memicu re-login manual (notify UI).

### 🎮 USER TRIGGER PROFILE — AFB88 (EVENT_DRIVEN)
- **A. Default State**: Hanya `pgMain` (Heartbeat) yang muncul. **STATUS: HEARTBEAT_ONLY**.
- **B. Required User Triggers**:
    1. Klik cabang olahraga (Soccer).
    2. Klik menu League atau Match List.
    3. Pastikan tabel market terbuka.
- **C. Substantive Signal**: `POST /api/pgBetOdds`.
- **D. Extension Activator Rules**: 
    - **Detect Provider**: AFB88.
    - **Actions**: Auto-click market tab / simulated scroll / odds table hover setiap 15-30 detik.
    - **Objective**: Memaksa server mengirim `pgBetOdds`.
- **E. Failure Mode**: Jika hanya `pgMain` > 30s, status tetap `HEARTBEAT_ONLY`. Extension harus re-trigger UI flow.
- **F. Backend Rules**: `pgMain` dilarang keras melahirkan data (Worker Birth). Hanya `pgBetOdds` yang boleh men-trigger flow processing.

**GLOBAL RULE:**
Provider tidak boleh dianggap LIVE, tidak boleh spawn pairing, dan tidak boleh mempengaruhi arbitrage engine sebelum Substantive Signal terpenuhi sesuai definisi di dokumen ini.

---

## 🧪 Provider Validation Checklist

Digunakan untuk audit saat menambah provider baru atau debugging flow macet.

### AFB88 Audit (Example):
1. **Open DevTools → Network**
2. **Expectation After Login**:
    - ✅ `/api/pgMain` looping tiap X detik.
    - ❌ **TIDAK BOLEH** ada odds mengalir sebelum interaksi.
3. **Expectation After UI Trigger**:
    - ✅ `POST /api/pgBetOdds` terpanggil.
    - ✅ Response berisi `odds_batch` atau array objek odds.
4. **Validation**: Jika (3) tidak terjadi, Activator di Extension dianggap GAGAL.

## ## 6. PROVIDER PROFILE: AFB88 (MPO Whitelabel)
- **Profile**: EVENT_DRIVEN / PATH_SESSION
- **Signature Discovery**: 
    - WebSocket: `wss://ws5.prosportslive.net:8887/fnOddsGen`
- **Authentication**: 
    - Header: `Authorization` (Token dinamis)
    - Header: `usetoken` (Boolean flag)
- **Normalization Law**:
    - Odds Type: HK/MY/DEC (Capture dari payload)
    - Match ID: Harus diekstrak dari frame `fnOddsGen`
- **Trigger Spec**: Jika stream mati, Extension wajib memicu menu 'Sports' pada UI MPO untuk regenerasi Authorization.
