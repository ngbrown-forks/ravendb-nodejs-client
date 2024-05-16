import { IChangesObservable } from "./IChangesObservable.js";

export interface ICounterChanges<TChanges> {
    /**
     * Subscribe for changes for all counters.
     */
    forAllCounters(): IChangesObservable<TChanges>;

    /**
     * Subscribe to changes for all counters with a given name.
     */
    forCounter(counterName: string): IChangesObservable<TChanges>;

    /**
     * Subscribe to changes for counter from a given document and with given name.
     */
    forCounterOfDocument(documentId: string, counterName: string): IChangesObservable<TChanges>;

    /**
     * Subscribe to changes for all counters from a given document.
     */
    forCountersOfDocument(documentId: string): IChangesObservable<TChanges>;
}