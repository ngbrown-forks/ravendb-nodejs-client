import { TimeSeriesQueryResult } from "./TimeSeriesQueryResult.js";
import { TypedTimeSeriesRangeAggregation } from "./TypedTimeSeriesRangeAggregation.js";

export class TypedTimeSeriesAggregationResult<T extends object> extends TimeSeriesQueryResult {
    public results: TypedTimeSeriesRangeAggregation<T>[];
}