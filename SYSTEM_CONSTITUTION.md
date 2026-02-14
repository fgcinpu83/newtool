# 📜 KONSTITUSI SISTEM (SYSTEM CONSTITUTION v1.0)

Ini dokumen kebenaran tunggal.
Copilot WAJIB mengikuti ini, tidak boleh improvisasi.

## I. PRINSIP UTAMA (TIDAK BOLEH DILANGGAR)

### Single Source of Truth

**Frontend:** React Context

**Backend:** Manager (singleton)

Tidak boleh ada state paralel

### State Machine, BUKAN Boolean Bebas

Semua lifecycle pakai enum/state

Tidak ada if (ready && connected) liar

### No Side Effect Tanpa Guard

Semua eksekusi HARUS lewat guard

Guard satu pintu

### Event ≠ Action

Event hanya mengubah state

Action hanya dipanggil oleh executor

## II. ARSITEKTUR FINAL (HIGH LEVEL)
```
[ Chrome ]
    ↓ CDP
[ ChromeConnectionManager ]
    ↓ state
[ ProviderSessionManager ]
    ↓ state
[ ExecutionGuard ]
    ↓ allowed
[ ExecutionEngine ]
```

Frontend HANYA MELIHAT STATE, tidak pernah memicu logic.

## III. BACKEND CONSTITUTION (WAJIB)

### 1️⃣ ChromeConnectionManager

Satu-satunya pintu Chrome

**State:**
- DISCONNECTED
- CONNECTING
- CONNECTED
- ERROR

**Aturan:**
- attach() idempotent
- Tidak boleh attach jika CONNECTING/CONNECTED
- Semua file chrome dilarang buat koneksi sendiri

### 2️⃣ ProviderSessionManager

Satu-satunya kebenaran provider

**State per provider:**
- INIT
- LOGGED_IN
- READY
- ERROR

**Aturan:**
- Provider hanya MELAPOR
- Manager yang MENENTUKAN status

### 3️⃣ ExecutionGuard

Pintu hidup/mati sistem

**assertExecutable():**
- chrome === CONNECTED
- provider === READY
- system === READY

➡️ Jika gagal → THROW
➡️ Tidak ada bypass

### 4️⃣ ExecutionEngine

Tempat SATU-SATUNYA bet terjadi

**Aturan:**
- Tidak dengar socket
- Tidak dengar provider
- Hanya dengar guard + command

## IV. FRONTEND CONSTITUTION (WAJIB)

Frontend TIDAK PUNYA LOGIC

Frontend TIDAK MENGAMBIL KEPUTUSAN

Frontend hanya:

- subscribe state
- render status
- kirim command eksplisit (toggle)

> User Workflow (operator) is canonical in `e:\newtool\_MASTER_CONTEXT.md` — see the **User Workflow** section in that file for the authoritative procedure.

## V. EVENT CONTRACT (WAJIB)

Event hanya bentuk ini:

- system:state
- chrome:state
- provider:state
- execution:state

Tidak ada event bebas.