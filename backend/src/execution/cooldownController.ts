export class CooldownController {
    private lastExecution = 0;

    async enforceCooldown(ms = 60000) {
        const now = Date.now();
        const wait = (this.lastExecution + ms) - now;
        if (wait > 0) {
            await new Promise(r => setTimeout(r, wait));
        }
        this.lastExecution = Date.now();
    }

    resetCooldown_TEST_ONLY() {
        this.lastExecution = 0;
    }
}

// For backward compatibility, export a singleton instance
const globalController = new CooldownController();
export const enforceCooldown = globalController.enforceCooldown.bind(globalController);
export const resetCooldown_TEST_ONLY = globalController.resetCooldown_TEST_ONLY.bind(globalController);
