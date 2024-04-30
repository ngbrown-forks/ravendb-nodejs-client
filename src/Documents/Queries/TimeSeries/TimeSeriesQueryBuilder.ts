import { ITimeSeriesQueryBuilder } from "./ITimeSeriesQueryBuilder.js";
import { TimeSeriesQueryResult } from "./TimeSeriesQueryResult.js";

export class TimeSeriesQueryBuilder implements ITimeSeriesQueryBuilder {
    private _query: string;

    raw<T extends TimeSeriesQueryResult>(queryText: string): T {
        this._query = queryText;
        return null;
    }

    public get queryText() {
        return this._query;
    }
}
