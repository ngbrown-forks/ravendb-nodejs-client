import { ILoaderWithInclude } from "./ILoaderWithInclude.js";
import { IDocumentSessionImpl } from "../IDocumentSession.js";
import { DocumentType } from "../../DocumentAbstractions.js";
import { TypeUtil } from "../../../Utility/TypeUtil.js";
import { EntitiesCollectionObject } from "../../../Types/index.js";

/**
 * Fluent implementation for specifying include paths
 * for loading documents
 */
export class MultiLoaderWithInclude implements ILoaderWithInclude {

    private _session: IDocumentSessionImpl;
    private _includes: string[] = [];

    /**
     * Includes the specified path.
     */
    public include(path: string): ILoaderWithInclude {
        this._includes.push(path);
        return this;
    }

    /**
     * Loads the specified id.
     */
    public async load<TResult extends object>(id: string, documentType?: DocumentType<TResult>): Promise<TResult | null>;
    /**
     * Loads the specified id.
     */
    public async load<TResult extends object>(
        id: string,
        documentType?: DocumentType<TResult>): Promise<TResult | null>;

    /**
     * Loads the specified ids.
     */
    public async load<TResult extends object>(
        ids: string[],
        documentType?: DocumentType<TResult>): Promise<EntitiesCollectionObject<TResult>>;
    /**
     * Loads the specified ids.
     */
    public async load<TResult extends object>(
        ids: string | string[],
        documentType?: DocumentType<TResult>)
        : Promise<TResult | null | EntitiesCollectionObject<TResult>> {

        let singleResult = false;
        if (TypeUtil.isString(ids)) {
            ids = [ids] as string[];
            singleResult = true;
        }

        const entityType = this._session.conventions.getJsTypeByDocumentType(documentType);

        const results = await this._session.loadInternal(ids as string[], {
            includes: this._includes,
            documentType: entityType
        });

        return singleResult ?
            Object.keys(results).map(x => results[x]).find(x => x) as TResult :
            results;
    }

    /**
     * Initializes a new instance of the MultiLoaderWithInclude class
     */
    public constructor(session: IDocumentSessionImpl) {
        this._session = session;
    }

}
