import { throwError } from "../Exceptions/index.js";

export function isValidUri(uriString: string): boolean {
    try {
        new URL(uriString);
        return true;
    } catch {
        return false;
    }
}

export function validateUri(uriString: string): void {
    if (!isValidUri(uriString)) {
        throwError("InvalidArgumentException", `Uri ${uriString} is invalid.`);
    }
}
