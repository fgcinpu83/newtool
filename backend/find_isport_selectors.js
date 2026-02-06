const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function findSelectors() {
    const list = await CDP.List();
    const target = list.find(t => t.url.includes('NewIndex')) || list.find(t => t.url.includes('aro0061'));
    if (!target) return console.log("Target not found");

    const client = await CDP({ target: target.webSocketDebuggerUrl });
    const { Runtime, Page, Target } = client;
    await Runtime.enable();
    await Page.enable();

    // Nuclear option: Scan ALL frames using Page.getFrameTree and Runtime.evaluate in each
    async function scanFrames(frame) {
        console.log(`Scanning Frame: ${frame.url} (ID: ${frame.id})`);
        try {
            // Create a temporary script to find team-like patterns
            const script = `
                (function() {
                    let results = "";
                    const elements = document.querySelectorAll('*');
                    for (let el of elements) {
                        const text = el.textContent.trim();
                        // Look for typical team names or " vs "
                        if (text.includes(" vs ") && text.length < 100) {
                            results += "FOUND VS: " + text + " | TAG: " + el.tagName + " | CLASS: " + el.className + "\\n";
                            // Dump siblings to find odds
                            const parent = el.parentElement;
                            results += "PARENT: " + parent.tagName + " class=" + parent.className + "\\n";
                        }
                        
                        // Look for specific SABA keywords if present
                        if (el.className && (el.className.includes('HomeName') || el.className.includes('AwayName') || el.className.includes('oddsBet'))) {
                            results += "FOUND SABA CLASS: " + el.className + " | TEXT: " + text + "\\n";
                        }
                    }
                    return results || "NOTHING FOUND HERE";
                })()
             `;

            // We need to get the execution context for this frame
            // Simplified: just try evaluate on the main target if same-origin
            const { result } = await Runtime.evaluate({ expression: script, returnByValue: true });
            return result.value;
        } catch (e) { return "Error scanning: " + e.message; }
    }

    const tree = await Page.getFrameTree();
    let finalReport = "ISPORT SELECTOR REPORT\n======================\n";

    // Try main
    finalReport += await scanFrames(tree.frameTree.frame);

    // Try children
    if (tree.frameTree.childFrames) {
        for (let child of tree.frameTree.childFrames) {
            finalReport += "\n\n--- CHILD ---\n";
            finalReport += await scanFrames(child.frame);
        }
    }

    fs.writeFileSync('isport_selectors.txt', finalReport);
    console.log("Saved to isport_selectors.txt");
    await client.close();
}
findSelectors();
