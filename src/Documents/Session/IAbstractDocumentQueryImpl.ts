import { FieldsToFetchToken } from "./Tokens/FieldsToFetchToken.js";
import { QueryOperation } from "./Operations/QueryOperation.js";

/**
 * This is used as an abstraction for the implementation
 * of a query when passing to other parts of the
 * query infrastructure. Meant to be internal only, making
 * this public to allow mocking / instrumentation.
 */
export interface IAbstractDocumentQueryImpl<T> {
    fieldsToFetchToken: FieldsToFetchToken;
    isProjectInto: boolean;
    initializeQueryOperation(): QueryOperation;
}
