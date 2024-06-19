import { EssentialIndexInformation } from "./EssentialIndexInformation.js";

export interface AbstractDatabaseStatistics<TIndexInformation extends EssentialIndexInformation> {
    countOfIndexes: number;
    countOfDocuments: number;
    countOfRevisionDocuments: number;
    countOfDocumentsConflicts: number;
    countOfTombstones: number;
    countOfConflicts: number;
    countOfAttachments: number;
    countOfCounterEntries: number;
    countOfTimeSeriesSegments: number;
    indexes: TIndexInformation[];
}
