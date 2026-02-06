export function calculateStakes(odd1: number, odd2: number, totalStake = 100) {
    const p1 = 1 / odd1;
    const p2 = 1 / odd2;
    const sum = p1 + p2;

    const stake1 = (totalStake * p1) / sum;
    const stake2 = (totalStake * p2) / sum;

    return { stake1, stake2, sum };
}
