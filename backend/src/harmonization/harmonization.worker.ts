import { harmonize } from "./oddsHarmonizer";
import { parentPort } from 'worker_threads';

if (parentPort) {
    parentPort.on('message', (e) => {
        try {
            const { normalizedMarkets } = e;
            const harmonized = harmonize(normalizedMarkets);
            parentPort?.postMessage(harmonized);
        } catch (err) {
            // console.error("Harmonization Worker Error", err);
            parentPort?.postMessage([]);
        }
    });
}
