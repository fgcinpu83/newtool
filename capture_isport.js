const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

async function capture() {
    try {
        const targets = await CDP.List();
        console.log('=== LIST ALL TABS ===');
        targets.forEach((t, i) => {
            console.log(`[${i}] ${t.title} (${t.url})`);
        });

        const target = targets.find(t =>
            t.url.includes('msy') ||
            t.url.includes('aro') ||
            t.url.includes('qq188') ||
            t.url.includes('saba') ||
            t.url.includes('mgf')
        );

        if (!target) {
            console.error('❌ ERROR: ISPORT/SABA tab not found.');
            return;
        }

        console.log(`\n🎯 Capturing: ${target.url}`);
        const client = await CDP({ target: target.webSocketDebuggerUrl });
        const { Runtime } = client;
        await Runtime.enable();

        const script = `
            (function() {
                let report = "=== ISPORT DOM ANALYSIS ===\\n";
                report += "URL: " + location.href + "\\n";
                report += "MAIN HTML:\\n" + document.documentElement.outerHTML.substring(0, 100000) + "\\n\\n";
                
                document.querySelectorAll('iframe').forEach((f, i) => {
                    try {
                        const doc = f.contentDocument || f.contentWindow.document;
                        report += "=== IFRAME [" + i + "] " + f.id + " ===\\n";
                        report += doc.documentElement.outerHTML.substring(0, 100000) + "\\n\\n";
                    } catch(e) {
                         report += "=== IFRAME [" + i + "] BLOCKED ===\\n\\n";
                    }
                });
                return report;
            })()
        `;

        const { result } = await Runtime.evaluate({ expression: script, returnByValue: true });
        fs.writeFileSync('isport_source_debug.html', result.value);
        console.log('✅ SUCCESS: Saved to isport_source_debug.html');
        await client.close();
    } catch (e) {
        console.error('❌ ERROR:', e.message);
    }
}
capture();
