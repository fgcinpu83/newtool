# ARBITRAGE MULTI-PROVIDER SYSTEM — STANDARD OPERATING PROCEDURE (LOCKED)

Version: Stable Core
Mode: Shadow Mode (Execution BLOCKED)
Scope: Multi-provider, single-session, parallel workers

---

## 1. USER WORKFLOW (OPERATOR SIDE)

### 1.1 System Start

* Start backend arbitrage system.
* Open dashboard UI.
* Confirm:

  * Shadow Mode = ACTIVE
  * Execution = BLOCKED

---

### 1.2 Account A (whitelabel)

1. Open mpo1221 dashboard.
2. Login manually.
3. Open providers ONE BY ONE:

   * AFB88 → wait lamp A1 = LIVE
   * BTI → wait lamp A2 = LIVE
4. After lamp is LIVE:

   * Provider tab may be CLOSED
   * mpo1221 dashboard MUST remain open

Result: Account A session bound and stable.

---

### 1.3 Account B (whitelabel)

1. Open qq188 dashboard.
2. Login manually.
3. Open providers ONE BY ONE:

   * CMD368 → wait lamp B1 = LIVE
   * ISPORT → wait lamp B2 = LIVE
4. Wait until:

   * Balance synced
   * Heartbeat OK
   * Seeker register logs appear

Result: Account B session bound and stable.

---

### 1.4 Daily Operation

Operator obligations:

* Do NOT close whitelabel dashboards
* Do NOT logout accounts
* Providers only opened when binding or reconnecting

System runs fully automatic:

* Sniffing
* Normalization
* Pairing
* Arbitrage calculation
* Shadow monitoring

---

### 1.5 If Provider Times Out

Recovery order:

1. Reopen whitelabel dashboard
2. If still inactive → open the provider tab
3. Wait lamp = LIVE
4. Close provider tab again

Backend restart only if core patch deployed.

---

## 2. SYSTEM WORKFLOW (ENGINE SIDE)

---

### 2.1 Session & Provider Layer

* Manual login → token stored
* Provider open → sniffer injected
* Provider LIVE → registry bind
* Tab closed → SESSION_BOUND
* Heartbeat maintains session

---

### 2.2 Sniffer & Worker Layer

Each provider:
Sniffer → Worker → Backend

Captures:

* Event list
* Markets
* Odds
* Balance

Workers push continuous batch updates.

---

### 2.3 Normalization Layer

Backend enforces:

* Decimal odds only
* Team & league cleaning
* Market mapping:

  * FT_HDP
  * FT_OU
  * HT_HDP
  * HT_OU

All packets tagged with:

* account
* provider
* subProvider

---

### 2.4 Discovery & Registry

* Builds unique Event Keys:
  account + provider + teamA + teamB

* Account A events = SEEKERS

* Account B events = TARGETS

No overwrite. No collision.

---

### 2.5 Multi-Provider Pairing

* Account A match is cloned into parallel pairing buckets:

  * A vs CMD368
  * A vs ISPORT
  * etc.

Isolation is guaranteed.

---

### 2.6 Market Matching

Pairing engine matches by:

* Fuzzy team names
* Market type
* Line / spread
* Live state

Valid match → PAIR CREATED

---

### 2.7 Arbitrage Engine

Formula:
(1 / oddsA) + (1 / oddsB) < 1

If TRUE:

* Profit calculated
* Stake split calculated
* UI updated

Shadow Mode:

* Execution permanently blocked

---

### 2.8 UI & Monitoring

UI shows:

* Provider state
* Balance
* Paired rows only
* Shadow reports
* Arbitrage table

Backend auto-manages:

* Heartbeat
* Stale cleanup
* Re-pairing

---

## 3. CORE PRINCIPLES

* Providers are only used for injection, not for continuous presence
* All intelligence lives in backend
* UI is monitoring + command only
* Multi-provider isolation is mandatory
* No execution while Shadow Mode active

---

## 4. SYSTEM STATUS DEFINITIONS

LIVE: provider connected and pushing odds
SESSION_BOUND: provider tab closed, session alive
INACTIVE: no heartbeat, needs rebind

---

## 5. SOP STATUS

This SOP is LOCKED.
Any system change must preserve:

* Single session rule
* Provider isolation
* Decimal normalization
* Shadow execution block

---

End of SOP
