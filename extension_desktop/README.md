Extension configuration

- Whitelabel URL: add per-account whitelabel in extension popup (`Whitelabel URL`) so the background will inject `injected.js` only into matching tabs.
- Backend WebSocket URL: set `ws://` or `wss://` in popup settings. Production should use `wss://`.

Usage:
1. Open extension popup → Accounts → add account with `Whitelabel URL` (a unique substring for your provider, e.g., `qq188` or `mpo1221`).
2. Save backend URL in the settings section.
3. When you add an account, the extension will attempt to inject into existing tabs that match that URL.
