const fs = require('fs');
const content = fs.readFileSync('e:\\new tools\\backend\\wire_debug.log', 'utf8');
const lines = content.split('\n');

console.log('--- RECENT BALANCE PAYLOADS ---');
for (let i = lines.length - 1; i >= 0 && i > lines.length - 1000; i--) {
    if (lines[i].includes('type=balance')) {
        console.log(lines[i]);
        // Search for the data dump nearby
        for (let j = i; j < i + 10 && j < lines.length; j++) {
            if (lines[j].includes('dataSize=') || lines[j].includes('{')) {
                // Peek at next line if it looks like JSON
                console.log('  ' + lines[j]);
            }
        }
    }
}
