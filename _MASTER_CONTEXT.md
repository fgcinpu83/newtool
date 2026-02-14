# ARBITRAGE SYSTEM MASTER CONTEXT: E:NEWTOOL
> ARCHITECTURE: Desktop Browser Edition v3.1
> STATUS: CRITICAL - DO NOT DELETE
> AUTHORITATIVE: This file is the canonical source for the *User Workflow* and operational procedures. Other docs must reference this file for operator steps.

## 1. PROJECT GOAL
Membangun sistem Arbitrage "Desktop Browser Edition" yang menangkap data via Extension (Network Sensor) dan memprosesnya di Backend (Stream Processor) dengan latensi minimum.
Target: High-frequency scanning pada provider Asian (AFB, SABA, etc).

## 2. TECH STACK (LOCKED)
- **Core Language:** TypeScript (Backend & Workers)
- **Extension:** JavaScript/TS (injected.js, content.js, background.js)
- **Database/Cache:** Redis (Wajib untuk deduplikasi odds cepat)
- **Architecture Style:** Event-Driven (Extension -> Stream -> Worker -> Arb Engine)

## 3. FILE STRUCTURE & ROLES
### /extension (The Sensor)
- `manifest.json`: Konfigurasi extension.
- `injected.js`: Script yang masuk ke dalam konteks halaman provider.
- `background.js`: Forwarder data dari browser ke Backend.
*Rule: Extension HANYA bertugas mengambil raw data (payload), DILARANG melakukan filtering berat di sini.*

### /backend (The Processor)
- `worker.service.ts`: Manager utama para worker.
- `afb_worker.ts`: Logika parsing spesifik provider AFB.
- `saba_worker.ts`: Logika parsing spesifik provider SABA.
- `arbitrage.service.ts`: Algoritma pembanding odds (Calculator).
*Rule: Setiap logika parsing provider HARUS terisolasi di filenya masing-masing.*

### /docs
- `provider_arsitek.md`: Referensi format data provider.

## 4. CURRENT WORKING STATE (LOG)
- [Stable] Extension stream forwarding.
- [Active] Tuning `afb_worker.ts` untuk akurasi odds.
- [Stable] Payload Inflation Middleware (GZIP/Base64) with UniversalDecoder.
- [Stable] Integrasi Redis caching (SETNX) untuk membuang odds duplikat.

## 5. RECENT ARCHITECTURAL DECISION (FROM GEMINI)
- Pastikan nama event dari extension konsisten dengan yang diterima di `worker.service.ts`.
- Gunakan Redis SETNX untuk locking ID pertandingan agar tidak diproses ganda.
- **[2026-01-24] GZIP Decoder Layer**: Implementasi `zlib` (Backend) dan `DecompressionStream` (Frontend) untuk menangani payload `H4s` (AFB88/Saba). Ini mengeliminasi "Ghost Match" dan crash regex pada stream terenkripsi.

### RECENT ARCHITECTURAL DECISION: GZIP/Base64 Payload Decoding Layer

**Date:** 2026-01-24  
**Problem:** Sistem mengalami crash pada modul regex (Uncaught SyntaxError) dan "Ghost Match" karena kegagalan parsing data WebSocket dari provider AFB88/Saba.

*   **Gejala:** Payload WebSocket diawali dengan signature `H4sIAAAAAAAE....`
*   **Diagnosa:** Data tidak dikirim dalam format JSON Plaintext, melainkan dikompresi menggunakan GZIP dan dibungkus (wrapped) dalam Base64 pada layer aplikasi (bukan protokol transport).
*   **Impact:** `injected.js` menganggap ini sebagai string biasa, menyebabkan kegagalan engine regex dan hilangnya data odds.

**Decision:** Implementasi "Payload Inflation Middleware" sebelum data masuk ke logic arbitrase.

*   **Intersepsi:** Tangkap raw message dari WebSocket.
*   **Deteksi:** Cek header signature `H4s` (Magic Number GZIP).
*   **Transformasi:**
    1.  Decode Base64 -> Binary Buffer.
    2.  Decompress GZIP -> JSON String.
    3.  Parse JSON -> Object.
*   **Forward:** Teruskan data bersih (Decoded Object) ke ArbitrageEngine dan UI.

**Technical Constraint:**
*   Gunakan `zlib` (Node.js) untuk backend atau `DecompressionStream` API untuk frontend.
*   Jangan mengubah logika betting/eksekusi yang sudah ada; hanya ubah cara data dibaca di pintu masuk.

---

### ADR-005: Elimination of Synthetic Fallbacks in Identity Resolution

**Status:** ENFORCED  
**Date:** 2026-01-25  

**Context:**  
The system previously generated "synthetic" IDs (random UUIDs or provider_rawID combinations) when Global ID resolution failed. This caused "Split Brain" scenarios where Account A and Account B processed the same real-world event as two different entities, breaking arbitrage logic and data lineage.

**Decision:**  
1.  **Strict Fail-Fast**: `resolveGlobalEventId` MUST throw an exception if a canonical Global ID cannot be found.
2.  **No Fallbacks**: Generating IDs on the fly in the consumer layer is STRICTLY FORBIDDEN.
3.  **Identity Source**: Only upstream mapping tables are trusted sources of truth.

**Consequences:**  
- The system will reject unmapped events (Error Rate spike is expected for bad data).
- Data consistency between Account A and Account B is mathematically guaranteed.


## RECENT ARCHITECTURAL DECISION (RAD)
**ID:** RAD-004-PROVIDER-ISOLATION
**Date:** 2026-01-26
**Status:** APPROVED / IMPLEMENTED

**Context:**
Integrasi multi-provider (AFB88, ISPORT) dalam `E:\newtool` memiliki risiko tinggi *session cross-contamination* dan *race condition* saat eksekusi arbitrase.

**Decision:**
1.  **Strict Adapter Pattern:** Setiap provider (ISPORT/AFB88) wajib memiliki *Class Adapter* terisolasi yang mewarisi `BaseProvider`. Dilarang keras menaruh logika provider langsung di *Main Loop*.
2.  **Atomic Execution:** Eksekusi betting harus bersifat atomik. Jika *Leg A* sukses tapi *Leg B* gagal, sistem harus otomatis memicu protokol *Hedging* atau *Rollback*, bukan sekadar melempar *error*.
3.  **Non-Blocking UI Injection:** Mekanisme injeksi DOM/Iframe harus berjalan di *thread* terpisah atau menggunakan *Async Queue* agar UI utama tidak *freeze*.

**Consequences:**
- Struktur folder modul provider harus dipisah tegas.
- Penambahan provider baru (misal: SBOBET) tidak akan merusak kode lama.
- *Error handling* menjadi tanggung jawab masing-masing adapter, bukan global handler.

---

### RAD-006: CONSTITUTION TOTAL ISOLATION — HARD ENFORCEMENT PATCH

**Status:** ENFORCED  
**Date:** 2026-02-12  
**Commit:** [0bce2f2ac788682c332822479b1fb3a1eb174d1c](https://github.com/fgcinpu83/newtool/commit/0bce2f2ac788682c332822479b1fb3a1eb174d1c)

**Context:**  
Comprehensive audit revealed multiple architectural violations of SYSTEM_CONSTITUTION.md rules, including frontend containing business logic, duplicate extensions, unvalidated backend commands, global mutable state, and potential side-effects. System risked non-deterministic behavior and single source of truth breaches.

**Decision:**  
Implemented 5-phase hard enforcement patch:
1. **Frontend Purification:** Removed 1141 lines of business logic from UI, replaced with pure subscriber architecture sending only explicit toggle_on/toggle_off commands.
2. **Extension Canonicalization:** Removed duplicate extension_desktop/, enforcing single canonical extension at root.
3. **Backend Command Gatekeeper:** Added command validator with 1s cooldown, FSM validation for toggle_on/toggle_off handlers.
4. **WebSocket Sanity Lock:** Encapsulated global mutable state (lastExecution) into CooldownController class with backward compatibility.
5. **Global Side-Effect Scan:** Verified no remaining violations across codebase.

**Consequences:**  
- Frontend now purely renders state and sends commands; no business logic.
- Backend validates all commands with guards and state machines.
- Global state encapsulated in classes, eliminating mutable side-effects.
- System now fully compliant with constitution rules, ensuring deterministic behavior and single source of truth.