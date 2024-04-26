import { AggregationOperation, AutoFieldIndexing, FieldStorage, GroupByArrayBehavior } from "./Enums.js";
import { AutoSpatialOptions } from "./Spatial/AutoSpatialOptions.js";

export interface AutoIndexFieldOptions {
    storage: FieldStorage;
    indexing: AutoFieldIndexing;
    aggregation: AggregationOperation;
    spatial: AutoSpatialOptions;
    groupByArrayBehavior: GroupByArrayBehavior;
    suggestions: boolean;
    isNameQuoted: boolean;
}