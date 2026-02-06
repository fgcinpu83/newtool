const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

async function capture() {
    try {
        const targets = await CDP.List();
        console.log('=== LIST SEMUA TAB TERBUKA ===');
        targets.forEach((t, i) => {
            console.log(`[${i}] TITLE: ${t.title}`);
            console.log(`    URL: ${t.url}`);
        });

        // Cari tab yang kemungkinan berisi sportsbook
        const target = targets.find(t =>
            t.url.includes('prosportslive') ||
            t.url.includes('wsfev2') ||
            t.url.includes('jps9') ||
            t.url.includes('afb') ||
            t.url.includes('saba') ||
            t.url.includes('sports')
        ) || targets.find(t => t.url.includes('mpo'));

        if (!target) {
            console.error('❌ GAGAL: Tidak ditemukan tab Sportsbook.');
            return;
        }

        console.log(`\n🎯 Menghubungkan ke tab: ${target.title} (${target.url})`);

        const client = await CDP({ target: target.webSocketDebuggerUrl });
        const { Runtime, Page } = client;

        await Page.enable();
        await Runtime.enable();

        const captureScript = `
            (function() {
                function getBase() {
                    let report = "=== DOCUMENT SOURCE ===\\n";
                    report += "URL: " + location.href + "\\n";
                    report += "TITLE: " + document.title + "\\n";
                    report += "-----------------------------------\\n";
                    report += document.documentElement.outerHTML + "\\n\\n";
                    return report;
                }

                let finalReport = getBase();

                const iframes = document.querySelectorAll('iframe');
                iframes.forEach((frame, idx) => {
                    try {
                        const frameDoc = frame.contentDocument || frame.contentWindow.document;
                        finalReport += "=== IFRAME [" + idx + "] SOURCE ===\\n";
                        finalReport += "ID: " + frame.id + " | CLASS: " + frame.className + "\\n";
                        finalReport += "SRC: " + frame.src + "\\n";
                        finalReport += "-----------------------------------\\n";
                        finalReport += frameDoc.documentElement.outerHTML + "\\n\\n";
                    } catch (e) {
                        finalReport += "=== IFRAME [" + idx + "] (BLOCKED BY CORS) ===\\n";
                        finalReport += "SRC: " + frame.src + "\\n\\n";
                    }
                });
                return finalReport;
            })()
        `;

        const { result } = await Runtime.evaluate({ expression: captureScript, returnByValue: true });
        const htmlSource = result.value;

        const outputPath = path.join(__dirname, 'debug_mpo_source.html');
        fs.writeFileSync(outputPath, htmlSource, 'utf8');

        console.log(`\x1b[32m%s\x1b[0m`, `✅ BERHASIL: Source HTML disimpan ke ${outputPath}`);
        await client.close();

    } catch (err) {
        console.error('❌ ERROR:', err.message);
    }
}

capture();
