import { IQueryBase } from "./IQueryBase.js";
import { IDocumentQueryBaseSingle } from "./IDocumentQueryBaseSingle.js";
import { IEnumerableQuery } from "./IEnumerableQuery.js";
import { FacetResult } from "../Queries/Facets/index.js";
import { ProjectionBehavior } from "../Queries/ProjectionBehavior.js";
import { IPagingDocumentQueryBase } from "./IPagingDocumentQueryBase.js";

export interface IRawDocumentQuery<T extends object>
    extends IQueryBase<T, IRawDocumentQuery<T>>, IPagingDocumentQueryBase<T, IRawDocumentQuery<T>>, IDocumentQueryBaseSingle<T>, IEnumerableQuery<T> {

    /**
     * Add a named parameter to the query
     */
    addParameter(name: string, value: any): IRawDocumentQuery<T>;

    projection(projectionBehavior: ProjectionBehavior): IRawDocumentQuery<T>;

    /**
     * Execute raw query aggregated by facet
     */
    executeAggregation(): Promise<Record<string, FacetResult>>;
}
