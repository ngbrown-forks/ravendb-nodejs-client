import { TimeSeriesQueryResult } from "./TimeSeriesQueryResult.js";
import { TimeSeriesEntry } from "../../Session/TimeSeries/TimeSeriesEntry.js";
import { ClassConstructor } from "../../../Types/index.js";
import { TypedTimeSeriesRawResult } from "./TypedTimeSeriesRawResult.js";

export class TimeSeriesRawResult extends TimeSeriesQueryResult {
    public results: TimeSeriesEntry[];

    public asTypedResult<T extends object>(clazz: ClassConstructor<T>) {
        const result = new TypedTimeSeriesRawResult<T>();
        result.count = this.count;
        result.results = this.results.map(x => x.asTypedEntry(clazz));
        return result;
    }
}
