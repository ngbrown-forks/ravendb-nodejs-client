import { IOperationProgress } from "./IOperationProgress.js";

export interface BulkInsertProgress extends IOperationProgress {
    total: number;
    batchCount: number;
    lastProcessedId: string;

    documentsProcessed: number;
    attachmentsProcessed: number;
    countersProcessed: number;
    timeSeriesProcessed: number;
}
