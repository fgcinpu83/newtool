let lastExecution = 0;

export async function enforceCooldown(ms = 60000) {
    const now = Date.now();
    const wait = (lastExecution + ms) - now;
    if (wait > 0) {
        await new Promise(r => setTimeout(r, wait));
    }
    lastExecution = Date.now();
}

export function resetCooldown_TEST_ONLY() {
    lastExecution = 0;
}
