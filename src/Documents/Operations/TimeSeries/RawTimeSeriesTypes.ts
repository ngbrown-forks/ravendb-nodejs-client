import { TimeValueUnit } from "../../../Primitives/TimeValueUnit.js";

export interface TimeSeriesPolicyRaw {
    Name: string;
    RetentionTime: TimeValueRaw;
    AggregationTime: TimeValueRaw;
}

export interface TimeSeriesCollectionConfigurationRaw {
    Disabled: boolean;
    Policies: TimeSeriesPolicyRaw[];
    RawPolicy: TimeSeriesPolicyRaw;
}

export interface TimeValueRaw {
    Value: number;
    Unit: TimeValueUnit;
}

export const TIME_SERIES_ROLLUP_SEPARATOR: string = "@";