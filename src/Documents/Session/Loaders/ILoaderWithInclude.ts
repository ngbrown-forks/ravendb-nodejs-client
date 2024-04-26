import { DocumentType } from "../../DocumentAbstractions.js";
import { EntitiesCollectionObject } from "../../../Types/index.js";

export interface ILoaderWithInclude {

    //TBD: overrides with expressions + maybe we TInclude, see:

    /**
     * Includes the specified path.
     */
    include(path: string): ILoaderWithInclude;

    /**
     * Loads the specified id.
     */
    load<TResult extends object>(id: string, documentType: DocumentType<TResult>): Promise<TResult | null>;

    /**
     * Loads the specified id.
     */
    load<TResult extends object>(
        id: string,
        documentType?: DocumentType<TResult>): Promise<TResult | null>;

    /**
     * Loads the specified ids.
     */
    load<TResult extends object>(
        ids: string[],
        documentType?: DocumentType<TResult>): Promise<EntitiesCollectionObject<TResult>>;
}
