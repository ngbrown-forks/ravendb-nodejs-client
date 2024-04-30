import { CONSTANTS } from "../../Constants.js";

export * from "./Replacers.js";
export * from "./Revivers.js";

export function tryGetConflict(metadata: object): boolean {
    return metadata[CONSTANTS.Documents.Metadata.CONFLICT] || false;
}
