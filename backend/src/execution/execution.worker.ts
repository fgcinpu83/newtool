import { executeArbitrage } from "./executionEngine";
import { parentPort } from 'worker_threads';

if (parentPort) {
    parentPort.on('message', async (data) => {
        try {
            const { opportunities } = data;
            const results = [];

            for (const opp of opportunities) {
                const r = await executeArbitrage(opp);
                if (r) results.push(r);
            }

            parentPort?.postMessage(results);
        } catch (err) {
            // console.error(err);
            parentPort?.postMessage([]);
        }
    });
}
