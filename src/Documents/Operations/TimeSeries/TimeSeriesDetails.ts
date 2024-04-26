import { TimeSeriesRangeResult } from "./TimeSeriesRangeResult.js";

export class TimeSeriesDetails {
    public id: string;
    public values: Map<string, TimeSeriesRangeResult[]>;
}