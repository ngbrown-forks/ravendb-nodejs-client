import { FacetOptions } from "./index.js";
import { IFacetOperationsBase } from "./IFacetOperationsBase.js";

export interface IFacetOperations<T> extends IFacetOperationsBase<T, IFacetOperations<T>> {
    withOptions(options: FacetOptions): IFacetOperations<T>;
}
