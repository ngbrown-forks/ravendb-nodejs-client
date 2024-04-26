import { TypedTimeSeriesRollupEntry } from "./TimeSeries/TypedTimeSeriesRollupEntry.js";

export interface ISessionDocumentRollupTypedAppendTimeSeriesBase<T extends object> {
    append(entry: TypedTimeSeriesRollupEntry<T>): void;
}
