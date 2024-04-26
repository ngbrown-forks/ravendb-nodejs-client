import { IIndexQuery } from "./IIndexQuery.js";
import { TypeUtil } from "../../Utility/TypeUtil.js";
import { ProjectionBehavior } from "./ProjectionBehavior.js";

export class IndexQueryBase<T> implements IIndexQuery {

    /**
     * @deprecated use LIMIT in RQL instead
     */
    public pageSize: number = TypeUtil.MAX_INT32;
    public query: string;
    public queryParameters: T;
    public projectionBehavior: ProjectionBehavior;
    /**
     * @deprecated use OFFSET in RQL instead
     */
    public start: number;
    public waitForNonStaleResults: boolean;
    public waitForNonStaleResultsTimeout: number;

    public get pageSizeSet(): boolean {
        return !TypeUtil.isNullOrUndefined(this.pageSize);
    }
}
