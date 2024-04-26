import { IncludeBuilderBase } from "./IncludeBuilderBase.js";
import { ITimeSeriesIncludeBuilder } from "./ITimeSeriesIncludeBuilder.js";

export class TimeSeriesIncludeBuilder extends IncludeBuilderBase implements ITimeSeriesIncludeBuilder {

    public includeTags(): ITimeSeriesIncludeBuilder {
        this.includeTimeSeriesTags = true;
        return this;
    }

    includeDocument(): ITimeSeriesIncludeBuilder {
        this.includeTimeSeriesDocument = true;
        return this;
    }
}