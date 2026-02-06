# 📁 Provider System - User-Driven Architecture

## ⚡ Konsep Utama

**TIDAK ADA HARDCODE DOMAIN!**

```
LAMA (Hardcode):
URL → Detect domain → Auto-assign provider
❌ Susah maintain, domain sering berubah

BARU (User-Driven):
User pilih provider di Dashboard → Traffic di-route berdasarkan account
✅ Flexible, user control penuh
```

## Struktur Folder

```
backend/src/providers/
├── index.ts                     # Central export
├── base.provider.ts             # Types & interfaces
├── account-binding.config.ts    # User config (provider per account)
├── provider-detector.service.ts # Routing service
├── saba/
│   ├── saba.config.ts           # SABA parser config
│   └── saba.parser.ts           # SABA payload parser
└── afb88/
    ├── afb88.config.ts          # AFB88 parser config
    └── afb88.parser.ts          # AFB88 payload parser
```

## Kapan Edit File Mana?

| Masalah | Edit File |
|---------|-----------|
| SABA format data berubah | `saba/saba.parser.ts` |
| AFB88 format data berubah | `afb88/afb88.parser.ts` |
| Tambah provider baru | Buat folder baru + update index |
| Ubah routing logic | `provider-detector.service.ts` |

## Cara Pakai

```typescript
import { routeAndParse, SystemConfig } from '../providers';

// Config dari Dashboard
const config: SystemConfig = {
    accountA: { account: 'A', provider: 'SABA', url: 'qq188.com', active: true },
    accountB: { account: 'B', provider: 'AFB88', url: 'mpo.com', active: true },
};

// Traffic masuk dari account A
const { routing, parsed } = routeAndParse('A', config, payload);
// routing.provider = 'SABA' (karena user set di dashboard)
```

## Flow

```
Dashboard: User pilih [Account A = SABA] [Account B = AFB88]
     ↓
Traffic dari Account A → routeAndParse('A', config, data) → SABA Parser
Traffic dari Account B → routeAndParse('B', config, data) → AFB88 Parser
```

## Menambah Provider Baru

1. Buat folder: `providers/newprovider/`
2. Buat `newprovider.config.ts` (copy dari saba.config.ts)
3. Buat `newprovider.parser.ts` (copy dari saba.parser.ts)
4. Tambah export di `index.ts`
5. Tambah detection di `provider-detector.service.ts`
