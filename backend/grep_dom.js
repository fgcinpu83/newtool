const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function grepDOM() {
    const mainTarget = (await CDP.List()).find(t => t.url.includes('NewIndex'));
    if (!mainTarget) return console.log("Target not found");

    const client = await CDP({ target: mainTarget.webSocketDebuggerUrl });
    const { Runtime } = client;
    await Runtime.enable();

    const script = `
        (function() {
            function find(win, path = "TOP") {
                let report = "";
                try {
                    const text = win.document.body.innerText;
                    if (text.length > 100) {
                         report += "--- FRAME: " + path + " (URL: " + win.location.href + ") ---\\n";
                         report += "TEXT PREVIEW: " + text.substring(0, 500).replace(/\\n/g, ' ') + "\\n\\n";
                         
                         // Search for specific ISPORT signatures
                         if (text.includes("Under") || text.includes("Over") || text.includes("Handicap")) {
                             report += "🎯 POTENTIAL SPORTSBOOK DETECTED!\\n";
                             // Save a bit of HTML for selector analysis
                             const rows = win.document.querySelectorAll('tr, div');
                             for (let r of rows) {
                                 if (r.innerText.includes(' vs ') || (r.className && r.className.includes('odds'))) {
                                     report += "SAMPLE ELEMENT: " + r.outerHTML.substring(0, 500) + "\\n";
                                     break;
                                 }
                             }
                         }
                    }
                    
                    for (let i = 0; i < win.frames.length; i++) {
                        report += find(win.frames[i], path + " -> " + i);
                    }
                } catch(e) { }
                return report;
            }
            return find(window);
        })()
    `;

    console.log("Searching all frames for sportsbook data...");
    const { result } = await Runtime.evaluate({ expression: script, returnByValue: true });
    fs.writeFileSync('isport_grep.txt', result.value);
    console.log("Done. Results in isport_grep.txt");
    await client.close();
}
grepDOM();
