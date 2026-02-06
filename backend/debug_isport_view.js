const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function debugIsport() {
    const targets = await CDP.List();
    const target = targets.find(t => t.url.includes('NewIndex')) || targets.find(t => t.url.includes('aro0061'));

    if (!target) return console.log("ISPORT target not found");

    console.log(`Connecting to ${target.url}...`);
    const client = await CDP({ target: target.webSocketDebuggerUrl });
    await client.Runtime.enable();

    // Script to scan for team-like text and report parent hierarchy
    const script = `
        (function() {
            function findTeam() {
                // SABA often uses specific classes for odds and teams
                let out = "";
                const all = document.querySelectorAll('*');
                let foundCount = 0;
                
                for (let el of all) {
                    const text = el.textContent.trim();
                    // Heuristic: Team names are usually 3-30 chars, no numbers, and often in specific containers
                    if (text.length >= 3 && text.length <= 40 && !text.match(/[0-9]/) && el.children.length === 0) {
                        // Check if it's likely a team (not a label like 'Home', 'Over', etc)
                        if (!['Home', 'Away', 'Over', 'Under', 'Hdp', 'Goal', 'Soccer', 'Today'].includes(text)) {
                            out += "TEXT: " + text + " | TAG: " + el.tagName + " | CLASS: " + el.className + " | ID: " + el.id + "\\n";
                            out += "PARENT: " + el.parentElement.tagName + " class=" + el.parentElement.className + "\\n";
                            out += "GRANDPARENT: " + el.parentElement.parentElement.tagName + " class=" + el.parentElement.parentElement.className + "\\n";
                            out += "-------------------\\n";
                            foundCount++;
                            if (foundCount > 10) break;
                        }
                    }
                }
                return out || "No matches found in this frame.";
            }
            
            function scanFrames(win, depth = 0) {
                if (depth > 4) return "";
                let res = "=== FRAME: " + win.location.href + " ===\\n";
                try {
                    res += findTeam.call(win) + "\\n";
                    for (let i = 0; i < win.frames.length; i++) {
                        res += scanFrames(win.frames[i], depth + 1);
                    }
                } catch(e) { res += "Access Denied\\n"; }
                return res;
            }
            return scanFrames(window);
        })()
    `;

    const { result } = await client.Runtime.evaluate({ expression: script, returnByValue: true });
    fs.writeFileSync('isport_selectors_debug.txt', result.value);
    console.log("Results saved to isport_selectors_debug.txt");
    await client.close();
}
debugIsport();
