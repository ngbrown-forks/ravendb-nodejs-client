import { AbstractTimeSeriesRange } from "./AbstractTimeSeriesRange.js";
import { TimeValue } from "../../../Primitives/TimeValue.js";
import { TimeSeriesRangeType } from "./TimeSeriesRangeType.js";

export interface TimeSeriesTimeRange extends AbstractTimeSeriesRange {
    time: TimeValue;
    type: TimeSeriesRangeType;
}