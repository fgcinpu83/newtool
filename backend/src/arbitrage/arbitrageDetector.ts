export function detectArbitrage(odd1: number, odd2: number) {
    if (odd1 <= 0 || odd2 <= 0) return null;
    const p = (1 / odd1) + (1 / odd2);
    if (p >= 1) return null;
    return p;
}
