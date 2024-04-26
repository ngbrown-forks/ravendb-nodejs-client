import { DatabaseChange } from "./DatabaseChange.js";
import { DocumentChange } from "./DocumentChange.js";
import { IndexChange } from "./IndexChange.js";

export class AggressiveCacheChange implements DatabaseChange {
    public static readonly INSTANCE = new AggressiveCacheChange();

    public static shouldUpdateAggressiveCache(change: DocumentChange | IndexChange): boolean {
        return change.type === "Put" || change.type === "Delete" || change.type === "BatchCompleted" || change.type === "IndexRemoved";
    }
}
