import { TimeSeriesQueryResult } from "./TimeSeriesQueryResult.js";
import { TypedTimeSeriesEntry } from "../../Session/TimeSeries/TypedTimeSeriesEntry.js";

export class TypedTimeSeriesRawResult<TValues extends object> extends TimeSeriesQueryResult {
    public results: TypedTimeSeriesEntry<TValues>[];
}