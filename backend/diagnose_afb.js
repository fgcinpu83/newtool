// 🔍 AFB CONTRACT DIAGNOSTIC SCRIPT
// Run: node diagnose_afb.js

const fs = require('fs');
const path = require('path');

console.log('🔍 AFB CONTRACT DIAGNOSTIC STARTED');

// Read recent logs for AFB data
const logsDir = path.join(__dirname, 'logs');
const logFiles = ['wire_debug.log', 'forensic_debug.log'];

let afbSamples = [];
let totalScanned = 0;

logFiles.forEach(logFile => {
    const logPath = path.join(logsDir, logFile);
    if (!fs.existsSync(logPath)) {
        console.log(`⚠️ ${logFile} not found`);
        return;
    }

    console.log(`📖 Scanning ${logFile}...`);
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n').reverse(); // Start from most recent

    lines.forEach(line => {
        totalScanned++;
        // Look for various AFB data markers
        if (line.includes('[AFB-BULK-SAMPLE]') ||
            (line.includes('AFB88') && line.includes('Sample=')) ||
            (line.includes('provider=B') && line.includes('raw='))) {

            // Extract JSON data
            let jsonStr = null;
            const sampleMatch = line.match(/Sample=\{([^}]+)\}/);
            const rawMatch = line.match(/raw=\{([^}]+)\}/);

            if (sampleMatch) {
                jsonStr = '{' + sampleMatch[1] + '}';
            } else if (rawMatch) {
                jsonStr = '{' + rawMatch[1] + '}';
            }

            if (jsonStr) {
                try {
                    const data = JSON.parse(jsonStr);
                    afbSamples.push({
                        source: logFile,
                        data,
                        line: line.substring(0, 150),
                        timestamp: line.match(/\[([^\]]+)\]/)?.[1] || 'unknown'
                    });
                } catch (e) {
                    afbSamples.push({
                        source: logFile,
                        raw: jsonStr,
                        line: line.substring(0, 150),
                        parseError: e.message,
                        timestamp: line.match(/\[([^\]]+)\]/)?.[1] || 'unknown'
                    });
                }
            }
        }
    });
});

console.log(`📊 SCANNED ${totalScanned} lines, FOUND ${afbSamples.length} AFB SAMPLES\n`);

// Analyze each sample
for (let i = 0; i < Math.min(afbSamples.length, 5); i++) {
    const sample = afbSamples[i];
    console.log(`🔬 SAMPLE ${i + 1} (${sample.timestamp} from ${sample.source}):`);
    console.log(sample.line);

    if (sample.data) {
        console.log('✅ PARSED DATA:');
        console.log('📋 TOP LEVEL KEYS:', Object.keys(sample.data));

        // Check for db array
        if (sample.data.db && Array.isArray(sample.data.db)) {
            console.log(`🗂️ DB ARRAY LENGTH: ${sample.data.db.length}`);
            if (sample.data.db.length > 0) {
                console.log('📋 FIRST DB ITEM KEYS:', Object.keys(sample.data.db[0]));
                console.log('💰 BALANCE IN DB[0]:', sample.data.db[0].Balance || sample.data.db[0].balance || 'NOT FOUND');
            }
        }

        // Check for js object
        if (sample.data.js) {
            console.log('📋 JS KEYS:', Object.keys(sample.data.js));
        }

        // Check for error
        if (sample.data.error) {
            console.log('⚠️ ERROR:', sample.data.error);
        }

        // Look for odds-like structures
        function findOdds(obj, path = '', depth = 0) {
            if (depth > 5) return;
            if (typeof obj !== 'object' || !obj) return;

            for (const [key, val] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;

                if (typeof val === 'string' && /^\d+\.\d+$/.test(val) && parseFloat(val) > 1) {
                    console.log(`🎯 POTENTIAL ODDS: ${currentPath} = ${val}`);
                }

                if (Array.isArray(val)) {
                    val.forEach((item, idx) => {
                        if (typeof item === 'object') {
                            findOdds(item, `${currentPath}[${idx}]`, depth + 1);
                        }
                    });
                } else if (typeof val === 'object') {
                    findOdds(val, currentPath, depth + 1);
                }
            }
        }

        console.log('🔍 SCANNING FOR ODDS PATTERNS:');
        findOdds(sample.data);

    } else if (sample.parseError) {
        console.log(`❌ PARSE ERROR: ${sample.parseError}`);
        console.log('RAW:', sample.raw?.substring(0, 200));
    }

    console.log('─'.repeat(50));
}

console.log('\n💡 RECOMMENDATIONS:');
console.log('1. Jika ada Balance di db[0], parser sudah handle');
console.log('2. Jika ada odds patterns, parser mungkin perlu adjust regex');
console.log('3. Jika tidak ada structure yang dikenal, perlu reverse-engineer API');
console.log('4. Check filter tidak block data (URL ws5.prosportslive.net)');
console.log('5. Pastikan extension capture URL yang benar untuk betting data');

console.log('\n🔍 DIAGNOSTIC COMPLETE');