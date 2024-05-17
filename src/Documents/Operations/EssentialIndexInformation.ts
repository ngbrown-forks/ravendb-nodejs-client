import { IndexLockMode, IndexPriority, IndexType } from "../Indexes/Enums.js";
import { IndexSourceType } from "../Indexes/IndexSourceType.js";

export interface EssentialIndexInformation {
    name: string;
    lockMode: IndexLockMode;
    priority: IndexPriority;
    type: IndexType;
    sourceType: IndexSourceType;
    archivedDataProcessingBehavior: ArchivedDataProcessingBehavior;
}