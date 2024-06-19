import { DocumentChange } from "./DocumentChange.js";
import { OperationStatusChange } from "./OperationStatusChange.js";
import { IndexChange } from "./IndexChange.js";
import { IConnectableChanges } from "./IConnectableChanges.js";
import { CounterChange } from "./CounterChange.js";
import { TimeSeriesChange } from "./TimeSeriesChange.js";
import { IIndexChanges } from "./IIndexChanges.js";
import { IOperationChanges } from "./IOperationChanges.js";
import { ICounterChanges } from "./ICounterChanges.js";
import { ITimeSeriesChanges } from "./ITimeSeriesChanges.js";
import { IDocumentChanges } from "./IDocumentChanges.js";

export interface IDatabaseChanges extends IDocumentChanges<DocumentChange>,
    IIndexChanges<IndexChange>,
    IOperationChanges<OperationStatusChange>,
    ICounterChanges<CounterChange>,
    ITimeSeriesChanges<TimeSeriesChange>,
    IConnectableChanges<IDatabaseChanges> {

}
