// 🔒 ARCHITECTURE GATE
// Governed by:
// - ARSITEKTUR_FINAL.md (Constitution)
// - provider_arsitek.md (Operational Law)
// Any logic here must map to a registered Provider Profile.
// Unauthorized behavior is an architectural violation.
// ============================================================

import { BaseApiWorker } from './api-worker';

export class SabaWorker extends BaseApiWorker {
    constructor(account: string = 'B', providerName: string = 'ISPORT') {
        super(account, providerName);
    }

    protected processPacket(obj: any) {
        if (!obj) return;

        // SABA / ISPORT Stream Processor (V3.1 Implementation)
        const scan = (target: any) => {
            if (!target || typeof target !== 'object') return;

            // Odds/Matches from PATH_SESSION data
            let items = [];
            if (target.Data && Array.isArray(target.Data)) items = target.Data;
            else if (target.SportItems && Array.isArray(target.SportItems)) items = target.SportItems;

            if (items.length > 0) {
                this.emit('odds_batch', items);
            }

            // Balance Extraction
            let balance = target.ba || target.balance;
            if (!balance && target.db && Array.isArray(target.db) && target.db[0]) {
                const db = target.db[0];
                balance = db.Balance || db.Balance2 || db.Balance2D;
            }
            if (balance !== undefined) {
                this.emit('balance', balance);
            }

            // Recurse
            if (Array.isArray(target)) {
                target.forEach(scan);
            } else {
                Object.values(target).forEach(val => {
                    if (val && typeof val === 'object') scan(val);
                });
            }
        };

        scan(obj);
    }
}
