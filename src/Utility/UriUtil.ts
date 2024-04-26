import { throwError } from "../Exceptions/index.js";
import { parse } from "node:url";

export function isValidUri(uriString: string): boolean {
    const parsed = parse(uriString);
    return !!(parsed.host && parsed.protocol);
}

export function validateUri(uriString: string): void {
    if (!isValidUri(uriString)) {
        throwError("InvalidArgumentException", `Uri ${uriString} is invalid.`);
    }
}
