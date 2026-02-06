# System Architecture

## CORE ENGINE COMPONENTS

### 1. Discovery Layer
- **Responsibility**: Find and bind events from multiple providers.
- **Key Doc**: `AUTO_NAV_ARCHITECTURE.md`
- **Output**: `ConfirmedPair` (GlobalEventID)

### 2. Normalization Layer
- **Responsibility**: Convert raw provider data into standard format.
- **Key Doc**: `../normalization/MARKET_NORMALIZATION.md`
- **Output**: `NormalizedMarket` (Decimal Odds)

### 3. Pairing Layer
- **Responsibility**: Match normalized markets to find arbitrage.
- **Key Doc**: `EVENT_PAIRING_ENGINE.md`
- **Output**: `ActivePair` (Arb Opportunity)

### 4. Direct References
- **[FLOW_DIAGRAM.md](./FLOW_DIAGRAM.md)**: High-level system data flow.
