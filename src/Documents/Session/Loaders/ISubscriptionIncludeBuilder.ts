import { IDocumentIncludeBuilder } from "./IDocumentIncludeBuilder.js";
import { ICounterIncludeBuilder } from "./ICounterIncludeBuilder.js";
import { ISubscriptionTimeSeriesIncludeBuilder } from "./ISubscriptionTimeSeriesIncludeBuilder.js";

export interface ISubscriptionIncludeBuilder extends IDocumentIncludeBuilder<ISubscriptionIncludeBuilder>,
    ICounterIncludeBuilder<ISubscriptionIncludeBuilder>, ISubscriptionTimeSeriesIncludeBuilder<ISubscriptionIncludeBuilder> {
}