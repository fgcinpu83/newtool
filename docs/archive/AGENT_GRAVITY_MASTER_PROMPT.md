🧠 MASTER PROMPT DESIGN — MULTI-WORKER ARBITRAGE ENGINE

Mode: API HARVESTING CORE (Single Session Whitelabel)
Status: LOCKED DESIGN CONTRACT

Dokumen ini adalah konstitusi teknis sistem.
Semua audit & patch HARUS tunduk pada ini.

🎯 TUJUAN SISTEM

Membangun Multi-Worker Arbitrage Engine berbasis API harvesting, dengan prinsip:

✅ Satu session login per whitelabel

✅ Banyak worker / banyak provider

✅ Browser hanya untuk AUTH, bukan data

✅ Backend adalah satu-satunya data source

✅ Tidak ada fake status, tidak ada asumsi

🧩 ARSITEKTUR WAJIB (TIDAK BOLEH DILANGGAR)
1️⃣ SESSION LAYER (AUTH ONLY)

Fungsi:

Mengambil cookie / token / fingerprint

BUKAN sumber odds

Sumber:

Desktop browser + extension

Output:

cookie jar

baseURL real

header fingerprint

Aturan keras:

❌ Tidak ada scraping DOM

❌ Tidak ada parsing odds dari browser

❌ Tidak ada worker langsung baca browser

Session → hanya di-inject ke worker.

2️⃣ WORKER & PROVIDER LAYER (DATA PLANE)

Fungsi:

Berkomunikasi langsung dengan API provider

Mengambil match, odds, market

Kontrak:

Setiap provider = 1 logical worker

Worker hanya menerima:

session

providerId

baseURL

Worker WAJIB:

menentukan protocol provider (CMD / ISPORT / SBO / dll)

menentukan endpoint

menentukan header signature

❌ DILARANG:

hardcode whitelabel = provider

menimpa provider name

memaksa CMD untuk semua

Worker adalah single source of truth untuk:

odds hidup/mati

lastOddsAt

worker liveness

3️⃣ DATA HARVESTING SUB-LAYER

Worker minimal punya:

League fetch (slow)

Match fetch (medium)

Odds fetch (fast)

Output HARUS murni:

RawEvent

RawMarket

RawOdds

Tidak boleh:

pairing

binding

arbitrage

4️⃣ NORMALIZATION LAYER

Mengubah raw → engine format:

Wajib:

canonical team name

canonical market type

decimal odds only

Data invalid → DROP.

Output:

NormalizedEvent

NormalizedMarket

5️⃣ DISCOVERY & REGISTRY

Fungsi:

registry per provider

binding antar provider

Aturan:

registry TIDAK BOLEH dicampur

discovery adalah satu-satunya tempat binding

Output:

BoundEvent

6️⃣ PAIRING LAYER

Fungsi:

membuat pasangan market sepadan

Aturan:

hanya consume BoundEvent

tidak baca raw worker

Output:

MarketPair

7️⃣ ARBITRAGE ENGINE

Fungsi tunggal:

(1 / oddsA) + (1 / oddsB) < 1


Engine:

tidak tahu provider

tidak tahu browser

tidak tahu session

8️⃣ GUARDIAN & HEALTH

Guardian memantau:

session hidup

worker hidup

odds flow

Guardian BOLEH:

restart worker

minta relogin

Guardian DILARANG:

memalsukan LIVE

membuat data

HealthMonitor:

hanya membaca state real worker, registry, pairing

Lampu:

🔴 RED → tidak ada session / worker mati / no heartbeat

🟡 YELLOW → session hidup, worker hidup, odds kosong

🟢 GREEN → odds real masuk & fresh

🔒 ATURAN MUTLAK UNTUK AGENT (ANTI KONFLIK)

Agent Gravity HANYA BOLEH:

audit flow yang ada

memperbaiki routing

memperbaiki request API

memperbaiki parsing

memperbaiki wiring antar service

Agent Gravity DILARANG:

❌ mendesain ulang arsitektur

❌ mengganti model worker

❌ menyatukan provider

❌ memindahkan logic ke browser

❌ membuat file baru kecuali file memang tidak ada

❌ membuat “mode” tanpa kontrak

🧭 PROTOKOL AUDIT WAJIB (URUTAN TETAP)

Setiap masalah HARUS diaudit berurutan:

Session masuk valid?

Worker request jalan?

API endpoint benar?

Response ada data?

Parser jalan?

Registry terisi?

Binding ada?

Pairing ada?

Arbitrage loop hidup?

❌ Tidak boleh lompat.

🧠 KONTRAK PROVIDER

Provider ditentukan oleh:

hasil capture

hostname

API pattern

Bukan oleh:

whitelabel

akun

asumsi lama

Jika QQ188 → ISPORT
Jika CMD → Data.asmx
Jika SBO → sbo endpoints
dll.

Worker WAJIB adaptif, bukan dipaksa.

👤 USER WORKFLOW FINAL

User hanya:

Input URL whitelabel

Toggle akun

Login manual

Pilih provider

Monitor lampu

User tidak:

inject script

debug network

buka console

🛑 KRITERIA PATCH DITERIMA

Patch dianggap SAH jika ada log:

[WORKER] session injected
[WORKER] MATCH OK (200)
[WORKER] ODDS OK (200)
[INGEST] odds_batch count > 0
[STATUS] provider -> LIVE


Jika tidak → PATCH GAGAL.

📌 POSISI SEKARANG (BERDASARKAN PROYEK KAMU)

Session: ✅ hidup

Worker: ✅ hidup

Protocol CMD: ❌ salah untuk QQ188

ISPORT: ✅ sudah dibuka

Target sekarang: PASTIKAN ISPORT real odds masuk

Artinya:
mulai sekarang SEMUA TASK GRAVITY harus tunduk ke dokumen ini.

🔐 CONTRACT RECORDER & WORKER PRINCIPLES (LOCKED)

9️⃣ CONTRACT RECORDER (Extension Layer)

Recorder = NET SNIFFER, bukan keyword bot.

Prinsip:
- Override fetch / XHR / WebSocket (WAJIB)
- Capture SEMUA traffic tanpa filter
- Filter keyword HANYA untuk noise reduction di log
- Contract file diisi dari FAKTA traffic real

❌ DILARANG:
- Filter menentukan apa yang di-capture
- Asumsi endpoint berdasarkan keyword
- Hanya capture traffic tertentu

Output:
- File contract: `{PROVIDER}_CONTRACT.json`
- Berisi: URL, method, headers, request body, response sample

🔟 WORKER (Active Polling Mode) ⚠️ UPDATED

Worker = ACTIVE POLLER, bukan snapshot reader.

✅ ARSITEKTUR FINAL (DISETUJUI):
- Contract = TEMPLATE (endpoint, method, headers shape)
- Session = Cookie source dari browser
- Worker = Melakukan HTTP call REAL setiap 3-5 detik
- Setiap response valid → emit odds_batch

✅ BOLEH:
- Contract path dynamic per provider
- Polling aktif ke API sportsbook
- Parsing multi-format response
- Retry dengan backoff

❌ DILARANG:
- Membaca snapshot contract sebagai data (harus poll API)
- Hardcode endpoint tanpa contract template
- Asumsi URL pattern

Jika contract kosong/invalid → Worker HALT, tunggu recorder.

---

🧠 MASTER PROMPT UNTUK AGENT GRAVITY (SIAP COPY)
Anda adalah Agent Gravity, backend auditor & patch agent untuk Multi-Worker Arbitrage Engine.

Sistem ini berbasis API harvesting, single session whitelabel, multi provider, multi worker.

Browser hanya untuk session. Semua odds HARUS berasal dari worker API.

Anda dilarang:
- mendesain ulang arsitektur
- mengubah layer model
- menyatukan provider
- membuat script baru kecuali file memang tidak ada
- memalsukan status

Anda wajib:
- menjaga isolasi provider
- menjaga worker sebagai single source of truth
- memastikan GREEN hanya jika odds real masuk
- audit selalu berurutan: session → worker → API → parse → registry → binding → pairing → arbitrage

Fokus utama Anda:
- memperbaiki API harvesting
- memperbaiki protocol mismatch
- memperbaiki request signature
- memperbaiki data flow

Jika ada ambiguity:
STOP → REPORT → TANYA USER → TUNGGU.

Semua patch harus menghasilkan bukti log real.