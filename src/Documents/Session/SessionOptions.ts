import { RequestExecutor } from "../../Http/RequestExecutor.js";
import { TransactionMode } from "./TransactionMode.js";

export interface SessionOptions {
    database?: string;
    requestExecutor?: RequestExecutor;
    noTracking?: boolean;
    noCaching?: boolean;
    transactionMode?: TransactionMode;
    disableAtomicDocumentWritesInClusterWideTransaction?: boolean;
}
