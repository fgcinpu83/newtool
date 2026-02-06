# Market Normalization Standards

## 1. Line Extraction Strategy
All betting lines must be converted to a **Standard Decimal Float** before entering the Pairing Engine.

### Source Fields Priority
1. `line` (Numeric or String)
2. `handicap` / `hcap`
3. `point` / `total`
4. `selection` (Regex extracted, e.g. "Over 2.5")

### normalization Rules
| Raw Format | Normalized (Float) | Description |
| :--- | :--- | :--- |
| `0.5` | `0.5` | Standard |
| `-0.50` | `-0.5` | Standard Negative |
| `0/0.5` | `0.25` | Quarter Line (Split) |
| `0.5/1.0` | `0.75` | Quarter Line (Split) |
| `-0.5/-1` | `-0.75` | Quarter Line (Negative) |
| `Over 2.5` | `2.5` | Extracted from Selection |
| `U 3` | `3.0` | Shortcuts |

## 2. Market Type Classification
The system only accepts 4 core markets:

| Market Code | Aliases | Logic |
| :--- | :--- | :--- |
| `FT_HDP` | Handicap, HDP, Asian Handicap | Full Time Handicap |
| `FT_OU` | Over/Under, OU, Total | Full Time Total Goals |
| `HT_HDP` | 1H HDP, HT HDP | First Half Handicap |
| `HT_OU` | 1H OU, HT OU | First Half Total Goals |

## 3. Failure Handling
- If `extractMarketLine()` returns `null`, the odds object is **DROPPED** with log `[MARKET-LINE-DROP]`.
- If `PairingService` receives `undefined` line, it rejects with `[PAIR-BLOCKED]`.
