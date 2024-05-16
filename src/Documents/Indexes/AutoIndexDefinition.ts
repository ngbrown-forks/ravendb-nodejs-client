import { IndexType } from "./Enums.js";
import { AutoIndexFieldOptions } from "./AutoIndexFieldOptions.js";
import { IndexDefinitionBase } from "./IndexDefinitionBase.js";


export interface AutoIndexDefinition extends IndexDefinitionBase {
    type: IndexType;
    collection: string;
    mapFields: Record<string, AutoIndexFieldOptions>;
    groupByFields: Record<string, AutoIndexFieldOptions>;
    groupByFieldNames: string[];
}
