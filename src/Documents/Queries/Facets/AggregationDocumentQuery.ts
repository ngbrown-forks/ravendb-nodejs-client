import { AggregationQueryBase } from "./AggregationQueryBase.js";
import { FacetBase } from "./FacetBase.js";
import { IAggregationDocumentQuery } from "./IAggregationDocumentQuery.js";
import { DocumentQuery } from "../../Session/DocumentQuery.js";
import { AbstractDocumentQuery } from "../../Session/AbstractDocumentQuery.js";
import { InMemoryDocumentSessionOperations } from "../../Session/InMemoryDocumentSessionOperations.js";
import { IFacetBuilder } from "./IFacetBuilder.js";
import { FacetBuilder } from "./FacetBuilder.js";
import { IndexQuery } from "../IndexQuery.js";
import { QueryResult } from "../QueryResult.js";

export class AggregationDocumentQuery<T extends object> extends AggregationQueryBase
    implements IAggregationDocumentQuery<T> {

    private _source: AbstractDocumentQuery<T, DocumentQuery<T>>;

    public constructor(source: DocumentQuery<T>) {
        super(source.session as any as InMemoryDocumentSessionOperations);
        this._source = source;
    }

    public andAggregateBy(facet: FacetBase): IAggregationDocumentQuery<T>;
    public andAggregateBy(builder: (facetBuilder: IFacetBuilder<T>) => void): IAggregationDocumentQuery<T>;
    public andAggregateBy(
        builderOrFacet: ((facetBuilder: IFacetBuilder<T>) => void) | FacetBase): IAggregationDocumentQuery<T> {
        if (typeof builderOrFacet === "function") {
            const f = new FacetBuilder<T>();
            builderOrFacet(f);
            return this.andAggregateBy(f.getFacet());
        }

        this._source._aggregateBy(builderOrFacet as FacetBase);
        return this;
    }

    protected _getIndexQuery(updateAfterQueryExecuted: boolean = true): IndexQuery {
        return this._source.getIndexQuery();
    }

    public emit(eventName: "afterQueryExecuted", queryResult: QueryResult) {
        if (eventName === "afterQueryExecuted") {
            this._source.emit(eventName, queryResult);
        }
    }
}
