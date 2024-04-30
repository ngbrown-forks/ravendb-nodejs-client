import { IQueryBase } from "./IQueryBase.js";
import { IDocumentQueryBaseSingle } from "./IDocumentQueryBaseSingle.js";
import { IEnumerableQuery } from "./IEnumerableQuery.js";
import { IDocumentQuery } from "./IDocumentQuery.js";
import { DocumentType } from "../DocumentAbstractions.js";
import { GraphDocumentQueryBuilder } from "./GraphDocumentQuery.js";

/**
 * @deprecated Graph API will be removed in next major version of the product.
 */
export interface IGraphDocumentQuery<T extends object> extends IQueryBase<T, IGraphDocumentQuery<T>>, IDocumentQueryBaseSingle<T>, IEnumerableQuery<T> {

    /**
     * @deprecated Graph API will be removed in next major version of the product.
     * @param alias
     * @param query
     */
    withQuery<TOther extends object>(alias: string, query: IDocumentQuery<TOther>): IGraphDocumentQuery<T>;

    /**
     * @deprecated Graph API will be removed in next major version of the product.
     * @param alias
     * @param rawGraphDocumentQueryBuilderQuery
     * @param documentType
     */
    withQuery<TOther extends object>(alias: string, rawGraphDocumentQueryBuilderQuery: string, documentType: DocumentType<TOther>): IGraphDocumentQuery<T>;

    /**
     * @deprecated Graph API will be removed in next major version of the product.
     * @param alias
     * @param queryFactory
     */
    withQuery<TOther extends object>(alias: string,
                                     queryFactory: (builder: GraphDocumentQueryBuilder) => IDocumentQuery<TOther>):
        IGraphDocumentQuery<T>;

    /**
     * @deprecated Graph API will be removed in next major version of the product.
     * @param alias
     * @param edgeSelector
     * @param query
     */
    withEdges(alias: string, edgeSelector: string, query: string): IGraphDocumentQuery<T>;
}
