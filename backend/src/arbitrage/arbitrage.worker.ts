import { evaluateMarket } from "./arbitrageEngine";
import { parentPort } from 'worker_threads';

if (parentPort) {
    parentPort.on('message', (data: any) => {
        try {
            const { harmonizedMarkets } = data;
            const results = [];

            for (const m of harmonizedMarkets) {
                const opp = evaluateMarket(m);
                if (opp) results.push(opp);
            }

            parentPort?.postMessage(results);
        } catch (err) {
            // console.error(err);
            parentPort?.postMessage([]);
        }
    });
}
