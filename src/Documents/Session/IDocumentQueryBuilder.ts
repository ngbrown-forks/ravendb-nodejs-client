import { AdvancedDocumentQueryOptions } from "./QueryOptions.js";
import { IDocumentQuery } from "./IDocumentQuery.js";
import { DocumentType } from "../DocumentAbstractions.js";
import { AbstractCommonApiForIndexes } from "../Indexes/AbstractCommonApiForIndexes.js";

/**
 * It gives the ability to construct queries with the usage of {@link IDocumentQuery} interface
 */
export interface IDocumentQueryBuilder {
    documentQuery<TEntity extends object>(opts: AdvancedDocumentQueryOptions<TEntity>): IDocumentQuery<TEntity>;
    documentQuery<TEntity extends object>(documentType: DocumentType<TEntity>): IDocumentQuery<TEntity>;
    documentQuery<TEntity extends object>(documentType: DocumentType<TEntity>, index: new () => AbstractCommonApiForIndexes): IDocumentQuery<TEntity>;
}