import { TimeSeriesEntry } from "../../Session/TimeSeries/TimeSeriesEntry.js";

export class TimeSeriesRangeResult {
    public from: Date;
    public to: Date;
    public entries: TimeSeriesEntry[];
    public totalResults: number;
    public includes: any;
}
