import { IndexLockMode, IndexPriority, IndexState, IndexType } from "../Indexes/Enums.js";
import { IndexSourceType } from "../Indexes/IndexSourceType.js";

export interface IndexInformation {
    name: string;
    isStale: boolean;
    state: IndexState;
    lockMode: IndexLockMode;
    priority: IndexPriority;
    type: IndexType;
    lastIndexingTime: Date;
    sourceType: IndexSourceType;
}
