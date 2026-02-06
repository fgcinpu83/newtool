
class LineExtractor {
    extractMarketLine(raw: any) {
        // Source Candidates
        const sources = [
            raw.line,
            raw.handicap,
            raw.hcap,
            raw.point,
            raw.total,
            raw.selection, // Often contains "Over 2.5"
            raw.oddsName
        ];

        for (const val of sources) {
            if (val === undefined || val === null) continue;
            const str = String(val).replace(/\s+/g, '').replace('Over', '').replace('Under', '').replace('O', '').replace('U', '');

            // 1. Numeric check (-0.50, 2.5)
            if (!isNaN(parseFloat(str)) && isFinite(parseFloat(str)) && !str.includes('/')) {
                return parseFloat(str);
            }

            // 2. Quarter Lines (0/0.5, 0.5/1)
            // Pattern: Number/Number
            const slashMatch = str.match(/^(-?\d+\.?\d*)\/(-?\d+\.?\d*)$/);
            if (slashMatch) {
                const n1 = parseFloat(slashMatch[1]);
                const n2 = parseFloat(slashMatch[2]);
                if (!isNaN(n1 + n2)) {
                    // Average (0.25) logic
                    return (n1 + n2) / 2;
                }
            }

            // 3. Quarter Lines with Dash is tricky (0.5-1)
            // Only valid if both are numbers and diff is 0.5
            const dashMatch = str.match(/^(-?\d+\.?\d*)-(-?\d+\.?\d*)$/);
            if (dashMatch) {
                const n1 = parseFloat(dashMatch[1]);
                const n2 = parseFloat(dashMatch[2]);
                if (Math.abs(Math.abs(n1) - Math.abs(n2)) === 0.5) {
                    return (n1 + n2) / 2;
                }
            }
        }

        return null; // Return null explicitly if not found
    }
}

const extractor = new LineExtractor();

function runTest(input: any, expected: any) {
    const result = extractor.extractMarketLine(input);
    const pass = result === expected;
    console.log(`Test: ${JSON.stringify(input)} -> Got: ${result} Expected: ${expected} [${pass ? 'PASS' : 'FAIL'}]`);
}

console.log("--- 🧪 LINE EXTRACTION TEST ---");

// Simple
runTest({ line: -0.5 }, -0.5);
runTest({ line: "-0.25" }, -0.25);
runTest({ line: "2.5" }, 2.5);

// Selection based
runTest({ selection: "Over 2.5" }, 2.5);
runTest({ selection: "Under 3.0" }, 3);
runTest({ selection: "O 1.75" }, 1.75);

// Quarter
runTest({ line: "0/0.5" }, 0.25);
runTest({ line: "0.5/1" }, 0.75);
runTest({ line: "-0.5/-1" }, -0.75);

// Invalid
runTest({ line: "Win" }, null);
runTest({ line: undefined }, null);

console.log("--- TEST END ---");
