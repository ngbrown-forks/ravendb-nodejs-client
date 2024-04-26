import { TimeSeriesQueryResult } from "./TimeSeriesQueryResult.js";

export interface ITimeSeriesQueryBuilder {
    raw<T extends TimeSeriesQueryResult>(queryText: string): T;
}