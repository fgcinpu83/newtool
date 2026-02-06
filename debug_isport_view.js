const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

async function debugIsport() {
    let client;
    try {
        const targets = await CDP.List();
        const target = targets.find(t =>
            t.url.includes('msy') ||
            t.url.includes('aro') ||
            t.url.includes('qq188') ||
            t.url.includes('saba') ||
            t.url.includes('mgf')
        );

        if (!target) {
            console.error('❌ ERROR: ISPORT/SABA tab not found. Make sure the browser is open.');
            return;
        }

        console.log(`🎯 Connecting to ISPORT: ${target.url}`);
        client = await CDP({ target: target.webSocketDebuggerUrl });
        const { Runtime, Page } = client;
        await Page.enable();
        await Runtime.enable();

        // Wait a bit for table to render if needed
        console.log('⏳ Waiting for content to settle...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        const captureScript = `
            (function() {
                function getCleanHTML(node) {
                    if (!node) return "";
                    // Remove scripts and styles to keep snapshot readable
                    const clone = node.cloneNode(true);
                    const junk = clone.querySelectorAll('script, style, link, svg, path');
                    junk.forEach(j => j.remove());
                    return clone.outerHTML;
                }

                let report = "=== ISPORT SNAPSHOT ===\\n";
                report += "URL: " + location.href + "\\n";
                report += "TITLE: " + document.title + "\\n\\n";
                
                // Root HTML
                report += "--- MAIN BODY ---\\n";
                report += getCleanHTML(document.body).substring(0, 50000) + "\\n\\n";

                // Check Iframes
                document.querySelectorAll('iframe').forEach((f, i) => {
                    try {
                        const doc = f.contentDocument || f.contentWindow.document;
                        report += "--- IFRAME [" + i + "] ID: " + f.id + " ---\\n";
                        report += getCleanHTML(doc.body).substring(0, 50000) + "\\n\\n";
                    } catch(e) {
                         report += "--- IFRAME [" + i + "] BLOCKED (CORS) or EMPTY ---\\n\\n";
                    }
                });
                return report;
            })()
        `;

        const { result } = await Runtime.evaluate({ expression: captureScript, returnByValue: true });
        const outputPath = path.join(__dirname, 'isport_snapshot.html');
        fs.writeFileSync(outputPath, result.value);
        console.log(`✅ SUCCESS: Snapshot saved to ${outputPath}`);

    } catch (e) {
        console.error('❌ ERROR:', e.message);
    } finally {
        if (client) await client.close();
    }
}

debugIsport();
