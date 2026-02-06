const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function snapshotAllSaba() {
    const list = await CDP.List();
    const sabaTargets = list.filter(t => t.url.includes('aro0061') || t.url.includes('saba'));
    console.log(`Found ${sabaTargets.length} potential SABA targets`);

    let report = "";
    for (let target of sabaTargets) {
        let client;
        try {
            console.log(`Capturing: ${target.url}`);
            client = await CDP({ target: target.webSocketDebuggerUrl });
            await client.Runtime.enable();
            const { result } = await client.Runtime.evaluate({
                expression: 'document.body.innerText.substring(0, 2000) + "\\n\\n" + document.body.innerHTML.substring(0, 5000)',
                returnByValue: true
            });
            report += `=== TARGET: ${target.url} ===\n${result.value}\n\n`;
            await client.close();
        } catch (e) { console.error(`Error on ${target.url}: ${e.message}`); }
    }
    fs.writeFileSync('saba_all_snapshot.txt', report);
    console.log("Saved to saba_all_snapshot.txt");
}
snapshotAllSaba();
