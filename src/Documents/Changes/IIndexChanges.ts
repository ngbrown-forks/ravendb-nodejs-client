import { IChangesObservable } from "./IChangesObservable.js";


export interface IIndexChanges<TChange> {
    /**
     * Subscribe to changes for specified index only.
     */
    forIndex(indexName: string): IChangesObservable<TChange>;

    /**
     * Subscribe to changes for all indexes.
     */
    forAllIndexes(): IChangesObservable<TChange>;
}