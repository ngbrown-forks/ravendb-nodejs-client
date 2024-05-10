export function importFix(name: string) {
    // fix to avoid static analysis on cloudflare environment.
    return name + "";
}