import { AbstractTimeSeriesRange } from "./AbstractTimeSeriesRange.js";

export interface TimeSeriesRange extends AbstractTimeSeriesRange {
    from: Date;
    to: Date;
}