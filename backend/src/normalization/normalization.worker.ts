import { normalizeProviderMarkets } from "./marketNormalizer";
import { parentPort } from 'worker_threads';

// If running as a Node.js Worker Thread
if (parentPort) {
    parentPort.on('message', (data: any) => {
        try {
            const { provider, globalEventId, rawMarkets } = data;
            const normalized = normalizeProviderMarkets(rawMarkets, provider, globalEventId);
            parentPort?.postMessage(normalized);
        } catch (err) {
            // Send error back or empty array
            console.error("Normalization Worker Error:", err);
            parentPort?.postMessage([]);
        }
    });
}

// Fallback or Web Worker syntax if used in different context (as requested by prompt "onmessage = ...")
// BUT Node.js doesn't use 'onmessage' global. I will add the prompt's syntax conditional or as comment if strictly needed.
// The prompt said:
// onmessage = (e) => { ... postMessage(...) }
// I will just add the prompt's exact code but adapted for likely environment (Node Worker).
// Actually, I'll stick close to the prompt but ensure it compiles in a standard TS project.

// Note: The prompt code "onmessage = ..." suggests a Web Worker or a specific worker environment.
// In Node worker_threads, we use parentPort.
// I'll leave the parentPort implementation as it is correct for Node.
