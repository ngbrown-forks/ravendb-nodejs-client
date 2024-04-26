import { DocumentType } from "../DocumentAbstractions.js";
import { AbstractCommonApiForIndexes } from "../Indexes/AbstractCommonApiForIndexes.js";

export interface DocumentQueryOptions<T extends object> {
    collection?: string;
    indexName?: string;
    index?: new () => AbstractCommonApiForIndexes;
    documentType?: DocumentType<T>;
}

export interface AdvancedDocumentQueryOptions<T extends object> extends DocumentQueryOptions<T> {
    isMapReduce?: boolean;
}
