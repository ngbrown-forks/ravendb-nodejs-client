import { TimeSeriesQueryResult } from "./TimeSeriesQueryResult.js";
import { TimeSeriesRangeAggregation } from "./TimeSeriesRangeAggregation.js";
import { EntityConstructor } from "../../../Types/index.js";
import { TypedTimeSeriesAggregationResult } from "./TypedTimeSeriesAggregationResult.js";

export class TimeSeriesAggregationResult extends TimeSeriesQueryResult {
    public results: TimeSeriesRangeAggregation[];

    public asTypedEntry<T extends object>(clazz: EntityConstructor<T>) {
        const result = new TypedTimeSeriesAggregationResult<T>();
        result.count = this.count;
        result.results = this.results.map(x => x.asTypedEntry(clazz));
        return result;
    }
}
