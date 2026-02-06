export function isOppositeSide(a: string, b: string) {
    if (a === "HOME" && b === "AWAY") return true;
    if (a === "AWAY" && b === "HOME") return true;
    if (a === "OVER" && b === "UNDER") return true;
    if (a === "UNDER" && b === "OVER") return true;
    return false;
}
