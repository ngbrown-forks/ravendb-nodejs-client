import { IndexLockMode, IndexPriority, IndexState, IndexType } from "../Indexes/Enums.js";
import { IndexSourceType } from "../Indexes/IndexSourceType.js";
import { EssentialIndexInformation } from "./EssentialIndexInformation.js";

export interface IndexInformation extends EssentialIndexInformation {
    isStale: boolean;
    state: IndexState;
    lastIndexingTime: Date;
}
