import { FacetAggregation } from "./index.js";
import { FacetToken } from "../../Session/Tokens/FacetToken.js";
import { FacetAggregationField } from "./FacetAggregationField.js";

export abstract class FacetBase {

    public displayFieldName: string;

    public aggregations: Map<FacetAggregation, Set<FacetAggregationField>> = new Map();

    public abstract toFacetToken(addQueryParameter: (o: any) => string): FacetToken;
}
