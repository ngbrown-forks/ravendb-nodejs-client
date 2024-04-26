import { IOperationResult } from "./IOperationResult.js";

export interface IndexOptimizeResult extends IOperationResult {
    indexName: string;
    message: string;
    shouldPersist: boolean;
}
