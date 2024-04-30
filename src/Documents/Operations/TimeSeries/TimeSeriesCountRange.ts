import { AbstractTimeSeriesRange } from "./AbstractTimeSeriesRange.js";
import { TimeSeriesRangeType } from "./TimeSeriesRangeType.js";

export interface TimeSeriesCountRange extends AbstractTimeSeriesRange {
    count: number;
    type: TimeSeriesRangeType;
}