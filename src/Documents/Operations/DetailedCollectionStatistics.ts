import { CollectionDetails } from "./CollectionDetails.js";

export interface DetailedCollectionStatistics {
    countOfDocuments: number;
    countOfConflicts: number;
    collections: Record<string, CollectionDetails>;
}
