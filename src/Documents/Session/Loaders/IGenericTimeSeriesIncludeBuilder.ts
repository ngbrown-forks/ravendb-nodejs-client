import { IAbstractTimeSeriesIncludeBuilder } from "./IAbstractTimeSeriesIncludeBuilder.js";
import { TimeSeriesRangeType } from "../../Operations/TimeSeries/TimeSeriesRangeType.js";
import { TimeValue } from "../../../Primitives/TimeValue.js";

export interface IGenericTimeSeriesIncludeBuilder<TBuilder> extends IAbstractTimeSeriesIncludeBuilder<TBuilder> {
    includeTimeSeries(name: string): TBuilder;
    includeTimeSeries(name: string, from: Date, to: Date): TBuilder;

    includeTimeSeries(name: string, type: TimeSeriesRangeType, time: TimeValue): TBuilder;
    includeTimeSeries(name: string, type: TimeSeriesRangeType, count: number): TBuilder;

    includeTimeSeries(names: string[], type: TimeSeriesRangeType, time: TimeValue): TBuilder;
    includeTimeSeries(names: string[], type: TimeSeriesRangeType, count: number): TBuilder;
}
