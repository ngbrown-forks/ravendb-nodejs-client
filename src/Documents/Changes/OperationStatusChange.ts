import { DatabaseChange } from "./DatabaseChange.js";

export interface OperationStatusChange extends DatabaseChange {
    operationId: number;
    state: any;
}
