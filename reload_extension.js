const CDP = require('chrome-remote-interface');

async function reloadExtension() {
  try {
    const client = await CDP();
    const { Runtime } = client;

    // Navigate to extensions page
    await Runtime.evaluate({
      expression: `window.location.href = 'chrome://extensions/'`
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Find extension and reload
    const result = await Runtime.evaluate({
      expression: `
        const items = document.querySelectorAll('extensions-item');
        for (const item of items) {
          const name = item.querySelector('#name').textContent;
          if (name.includes('Antigravity')) {
            const reloadBtn = item.shadowRoot.querySelector('cr-button[aria-label*="Reload"]');
            if (reloadBtn) {
              reloadBtn.click();
              console.log('Extension reloaded');
              return true;
            }
          }
        }
        return false;
      `
    });

    if (result.result.value) {
      console.log('✅ Extension reloaded successfully');
    } else {
      console.log('❌ Extension not found or reload failed');
    }

    await client.close();
  } catch (err) {
    console.error('❌ Error reloading extension:', err.message);
  }
}

reloadExtension();