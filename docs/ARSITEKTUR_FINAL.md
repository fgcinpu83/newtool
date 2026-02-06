📐 ARSITEKTUR FINAL v3.1 — DESKTOP EDITION

Versi: 3.1.0
Mode: Desktop Browser Only
Status: 🔒 LOCKED (Architecture Authority)

🎯 TUJUAN SISTEM

Membangun Multi-Provider Arbitrage Engine berbasis single browser session, di mana:

Semua API call dilakukan oleh website asli di browser

Extension bertindak sebagai network sensor & stream forwarder

Backend bertindak sebagai stream processor & arbitrage engine

Sistem stabil terhadap:

dynamic token

anti-bot ringan

perubahan struktur API provider

🛡️ ARCHITECTURE GATE & CHANGE GOVERNANCE

### 1. Dual-Layer Architecture Authority
- **ARSITEKTUR_FINAL.md** = Konstitusi sistem (global, immutable paradigm).
- **provider_arsitek.md** = Kitab operasional provider (rules, profiles, triggers, parsing law).
Semua perilaku sistem **WAJIB**:
- Sesuai dengan **ARSITEKTUR_FINAL.md**.
- Terpetakan secara eksplisit ke pasal di **provider_arsitek.md**.
*Jika tidak bisa dipetakan → ARSITEKTURAL ILEGAL.*

### 2. Architecture Gate Rule
Setiap perubahan code (backend / worker / extension / UI) **WAJIB** memenuhi 3 syarat dalam commit/deskripsi tugas:
1. Menyebut nama **Provider**.
2. Menyebut **Profile Arsitektur** (AUTO_PUSH, PATH_SESSION, EVENT_DRIVEN, dll).
3. Menyebut **Pasal/Section** di `provider_arsitek.md`.
*Jika salah satu tidak ada → perubahan DITOLAK.*

### 3. Change Protocol (Immutable)
Sebelum menyentuh baris kode apapun:
1. Update atau referensi ke **provider_arsitek.md**.
2. Tambahkan entri di **ARSITEKTUR_FINAL.md** → **Architecture Gate Log**.
3. Baru diperbolehkan melakukan modifikasi kode.

### 4. Hard Prohibition Layer
   - Dilarang menambah logic tanpa referensi pasal `provider_arsitek.md`.
   - Dilarang membuat generalisasi flow lintas provider (Setiap provider unik).
   - Dilarang menyatukan parsing, trigger, atau lifecycle yang berbeda profil.
   - Dilarang menambah auto-heal, auto-guess, atau backend-actor logic.
   - *Semua logic baru harus lahir di `provider_arsitek.md` terlebih dahulu.*

### 5. Mandatory Code Header
File inti berikut **WAJIB** memiliki header gatekeeper:
- `worker.service.ts`
- `api-worker.ts`
- `gateway.module.ts` / extension core (`content.js`, `background.js`)

```typescript
// 🔒 ARCHITECTURE GATE
// Governed by:
// - ARSITEKTUR_FINAL.md (Constitution)
// - provider_arsitek.md (Operational Law)
// Any logic here must map to a registered Provider Profile.
// Unauthorized behavior is an architectural violation.
```

🏗️ HIGH-LEVEL ARCHITECTURE
USER LOGIN ONCE
   ↓
BROWSER executes all sportsbook engines
   ↓
EXTENSION captures traffic & sessions
   ↓
BACKEND classifies, normalizes, pairs
   ↓
ARBITRAGE ENGINE


Backend tidak pernah menembak API sportsbook.

🧩 COMPONENT ARCHITECTURE
🖥️ BROWSER LAYER (Execution Layer)
Provider Pages

QQ188 / MPO / Whitelabel UI

Menjalankan engine asli provider (ISPORT, AFB, CMD, dll)

Satu login → banyak provider

Data Freshness Engine (Extension-side)

Tugas: memastikan semua provider tetap aktif walau tidak difokuskan.

Teknik yang diizinkan:

hidden tabs per provider

hidden iframes

auto-navigation rotator

market auto-open

visibility keep-alive

Output: website terus memanggil API semua provider.

🛰️ EXTENSION LAYER (Sensor Layer)

Extension tidak punya business logic.

Tugas:

capture session (cookies, UA, session URL)

capture fetch / XHR / WebSocket

capture response body

attach account context (A/B)

kirim raw packet ke backend via WebSocket

Extension dilarang:

memilih provider

memilih worker

memanggil API sendiri

menebak struktur

🧠 BACKEND LAYER (Processing Layer)
1. Gateway

menerima stream dari extension

command channel ke browser (open tab, activate provider, refresh, close)

2. ContractClassifier

Menganalisa setiap packet:

provider detection

stream type detection (match, odds, market, ws)

schema fingerprint

Output → ContractRegistry.

3. ContractRegistry (Runtime Authority)

Contract di v3.1 adalah:

Stream Protocol Descriptor, bukan Request Template.

Contract berisi:

provider identity

endpoint signature

response schema

stream type

parser binding

versioning

Fungsi:

registry kontrak aktif

deteksi perubahan struktur

binding worker

invalidasi stream

File JSON hanya audit snapshot.

4. WorkerManager (Orchestrator)

spawn worker per (account:provider)

subscribe ke ContractRegistry

bind / rebind worker ke kontrak

manage lifecycle & health

Worker key:

A:ISPORT
A:AFB
B:CMD
B:ISPORT

5. Stream Workers (Execution Unit)

Worker BUKAN harvester.

Worker tugas:

menerima stream dari browser

parsing & normalisasi

maintain match & odds state

emit odds_batch

supply arbitrage engine

Worker dilarang:

build URL

call API

handle token

retry request

probing endpoint

Jika stream mati:
→ worker emit STREAM_STALE
→ backend minta browser mengaktifkan provider

6. Arbitrage Engine

consume normalized odds

pairing multi provider A vs B

arbitrage detection

execution guard

📜 API CONTRACT DEFINITION (v3)

API Contract di v3.1 bukan executable API.

Ia adalah:

Traffic signature

Protocol description

Parsing agreement

Dipakai untuk:

mengenali provider

memilih parser

memvalidasi struktur

versioning perubahan API

Tidak dipakai untuk:

HTTP call

token storage

URL replay

🔁 DATA FRESHNESS ARCHITECTURE

Masalah: provider hanya kirim data saat UI aktif.
Solusi: freshness dijaga di browser.

Flow:

Backend detect stream stale
   ↓
Gateway → Extension: ACTIVATE_PROVIDER(ISPORT)
   ↓
Extension:
   - buka tab tersembunyi
   - buka market page
   - inject iframe
   ↓
Website memanggil API lagi
   ↓
Stream hidup kembali


Backend tidak pernah polling API.

🔄 FLOW SEQUENCE (UPDATED)
1. User start system
2. Open dashboard
3. Input URL + Toggle A/B
4. Backend opens browser tab
5. User login once
6. Extension captures session
7. User navigates providers
8. Extension streams API responses
9. ContractClassifier identifies provider & schema
10. ContractRegistry updates runtime contract
11. WorkerManager spawn/bind workers
12. Workers consume stream
13. Workers emit odds_batch
14. Arbitrage engine pairs & monitors
15. If stream stale → backend commands extension to re-activate provider

🟢 7. LAMP STATUS LOGIC (THE TRUTH)

Ada satu sumber kebenaran untuk Lampu UI: `WorkerService.providerStatus`.

| State | Warna | Syarat / Kondisi |
| :--- | :--- | :--- |
| **INACTIVE** | Grey | Slot kosong atau toggle OFF. |
| **DEAD** | Red | Guardian melapor DEAD (Timeout > 1h) atau Error. |
| **HEARTBEAT_ONLY** | Yellow | Session valid (`init/balance/heartbeat`) tapi ODDS kosong atau timeout > 30s. |
| **LIVE** | Green | Guardian LIVE (< 30s data) DAN Worker memverifikasi `data.length > 0`. |

🚥 8. DATA FLOW VALIDATION CHAIN

| Stage | Component | Action | Result |
| :--- | :--- | :--- | :--- |
| **Trigger** | Extension | UI Activator / Sniffer Click | Request fired |
| **Capture** | Extension | Hooked XHR/WS payload capture | Packet streamed |
| **Ingest** | WorkerService | Payload fingerprinting & routing | Worker bound |
| **Parse** | Worker | Protocol stripping & normalization | `odds_batch` emitted |
| **Audit** | Guardian | Liveness & Heartbeat monitoring | Status updated |


🔒 NON-NEGOTIABLE RULES

Backend never calls sportsbook API

Extension never chooses provider

Worker never builds request

Contract is descriptor, not executor

Account ownership comes from toggle

Provider identity comes from traffic

Freshness solved in browser, not backend

🏁 ACCEPTANCE CRITERIA

Single login → multi provider live

A:ISPORT, A:AFB, B:CMD concurrently green

No backend HTTP calls to sportsbook

Killing a tab → backend requests browser to revive it

Changing provider structure → new contract version auto-created

📜 ARCHITECTURE GATE LOG

[2026-01-16]
Change: Established Architecture Gate & Provider Registry Alignment
Provider: AFB88, ISPORT, CMD368
Profile: EVENT_DRIVEN, PATH_SESSION, AUTO_PUSH
provider_arsitek.md Reference: Section 1 (Global Model), Section 5 (Trigger Spec)
Files affected: ARSITEKTUR_FINAL.md, provider_arsitek.md, api-worker.ts, worker.service.ts, content.js
Purpose: Formalizing documentation authority and establishing change governance.

[2026-01-25]
Change: ADR-005 - Elimination of Synthetic Fallbacks in Identity Resolution (Strict Fail-Fast for Global ID)
Provider: ALL (AFB88, ISPORT, SABA)
Profile: EVENT_DRIVEN, IDENTITY_RESOLUTION
provider_arsitek.md Reference: Section 1 (Global Model), Section 4 (Architecture Flow)
Files affected: identity.resolver.ts, arbitrage.service.ts, _MASTER_CONTEXT.md
Purpose: Preventing Split Brain scenarios by enforcing strict identity resolution without synthetic fallbacks.

[2026-01-26]
Change: RAD-004 - Provider Isolation with Strict Adapter Pattern & Atomic Execution
Provider: AFB88, ISPORT, SABA
Profile: ADAPTER_PATTERN, ATOMIC_EXECUTION, NON_BLOCKING_UI
provider_arsitek.md Reference: Section 2 (Registry Table), Section 3 (Detail Sheets), Section 4 (Architecture Flow)
Files affected: providers/base-provider.ts, afb_adapter.ts, isport_adapter.ts, saba_adapter.ts, execution.engine.ts, ui_injection.service.ts, _MASTER_CONTEXT.md
Purpose: Isolating provider logic, ensuring atomic betting execution with hedging/rollback, and non-blocking UI injection to prevent cross-contamination and race conditions.

🗂️ SYSTEM ARCHITECTURE MAP

| File | Provider | Profile | provider_arsitek.md Section |
| :--- | :--- | :--- | :--- |
| `api-worker.ts` | ALL | Multi-Profile | Section 3 (Detail Sheets) |
| `worker.service.ts` | ALL | Orchestration | Section 4 (Architecture Flow) |
| `content.js` | ALL | Activator/Sniffer | Section 5 (Trigger Spec) |
| `provider.architecture.ts` | ALL | Registry | Section 2 (Registry Table) |
| `gateway.module.ts` | ALL | Passive Gateway | Section 4 (Architecture Flow) |

📌 STATUS

ANTIGRAVITY DESKTOP ENGINE v3.1
Architecture: 🔒 LOCKED (Gate Active)
Paradigm: Browser-Resident Multi-Provider Arbitrage