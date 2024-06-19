import { IndexState } from "../Indexes/Enums.js";
import { EssentialIndexInformation } from "./EssentialIndexInformation.js";

export interface IndexInformation extends EssentialIndexInformation {
    isStale: boolean;
    state: IndexState;
    lastIndexingTime: Date;
}
