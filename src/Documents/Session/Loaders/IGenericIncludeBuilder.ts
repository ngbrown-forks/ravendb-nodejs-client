import { IDocumentIncludeBuilder } from "./IDocumentIncludeBuilder.js";
import { ICounterIncludeBuilder } from "./ICounterIncludeBuilder.js";
import { ICompareExchangeValueIncludeBuilder } from "./ICompareExchangeValueIncludeBuilder.js";
import { IGenericTimeSeriesIncludeBuilder } from "./IGenericTimeSeriesIncludeBuilder.js";
import { IGenericRevisionIncludeBuilder } from "./IGenericRevisionIncludeBuilder.js";

export interface IGenericIncludeBuilder<TBuilder>
    extends IDocumentIncludeBuilder<TBuilder>,
        ICounterIncludeBuilder<TBuilder>,
        IGenericTimeSeriesIncludeBuilder<TBuilder>,
        ICompareExchangeValueIncludeBuilder<TBuilder>,
        IGenericRevisionIncludeBuilder<TBuilder> {
    
}
