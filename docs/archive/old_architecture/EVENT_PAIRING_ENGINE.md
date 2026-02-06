# Event Pairing Engine Documentation

## 1. Core Logic
The Pairing Engine is no longer a global fuzzy matcher. It is an **Event-Scoped Arithmetic Matcher**.

### Data Hierarchy
1.  **Event Bucket**: Container for all odds belonging to a specific `GlobalEventID`.
2.  **Odds Lists**: Separate lists for Provider A and Provider B within the bucket.
3.  **Pairs**: Generated only by comparing `Bucket[ID].OddsA` vs `Bucket[ID].OddsB`.

## 2. Market Rules

### A. Handicap (FT_HDP, HT_HDP)
*   **Selections**: Must correspond to opposite sides (Home vs Away).
*   **Lines**: Must sum to zero (or be arithmetic opposites).
    *   Example: Home `-0.50` vs Away `+0.50` (Sum = 0) -> **VALID**
    *   Example: Home `-0.50` vs Away `-0.50` (Sum != 0) -> **INVALID**

### B. Over/Under (FT_OU, HT_OU)
*   **Selections**: Must correspond to opposite outcomes (Over vs Under).
*   **Lines**: Must be equal.
    *   Example: Over `2.50` vs Under `2.50` (Diff = 0) -> **VALID**
    *   Example: Over `2.50` vs Under `2.75` (Diff != 0) -> **INVALID**

## 3. Spam Guard
To prevent flooding the frontend with duplicate signals for the same ongoing opportunity:
*   A `pairSignature` is generated: `EventID | Market | Line`.
*   If a pair with this signature is already `ACTIVE`, we update its timestamp but DO NOT emit a new alert.

## 4. Lifecycle
1.  **Ingest**: Worker injects `EventID` -> PairingService receives.
2.  **Buffer**: Odds stored in `EventRegistry`.
3.  **Scan**: Triggered immediately on ingestion. Scans ONLY the relevant Event Bucket.
4.  **Emit**: If match found & not spam -> Emit `scanner:update`.
5.  **Purge**: Inactive events (> 5 mins) are removed from memory.
