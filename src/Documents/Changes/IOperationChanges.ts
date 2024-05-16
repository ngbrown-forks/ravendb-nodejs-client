import { IChangesObservable } from "./IChangesObservable.js";

export interface IOperationChanges<TChanges> {
    /**
     * Subscribe to changes for specified operation only.
     */
    forOperationId(operationId: number): IChangesObservable<TChanges>;

    /**
     * Subscribe to change for all operation statuses.
     */
    forAllOperations(): IChangesObservable<TChanges>;
}