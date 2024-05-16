import { IChangesObservable } from "./IChangesObservable.js";

export interface ITimeSeriesChanges<TChanges> {
    /**
     * Subscribe to changes for all timeseries.
     */
    forAllTimeSeries(): IChangesObservable<TChanges>;

    /**
     * Subscribe to changes for all timeseries with a given name.
     * @param timeSeriesName Time series name
     */
    forTimeSeries(timeSeriesName: string): IChangesObservable<TChanges>;

    /**
     * Subscribe to changes for timeseries from a given document and with given name.
     * @param documentId Document identifier
     * @param timeSeriesName Time series name
     */
    forTimeSeriesOfDocument(documentId: string, timeSeriesName: string): IChangesObservable<TChanges>;

    /**
     * Subscribe to changes for timeseries from a given document.
     * @param documentId Document identifier
     */
    forTimeSeriesOfDocument(documentId): IChangesObservable<TChanges>;
}