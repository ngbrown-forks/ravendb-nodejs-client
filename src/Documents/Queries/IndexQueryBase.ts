import { IIndexQuery } from "./IIndexQuery.js";
import { TypeUtil } from "../../Utility/TypeUtil.js";
import { ProjectionBehavior } from "./ProjectionBehavior.js";

export class IndexQueryBase<T> implements IIndexQuery {

    public query: string;
    public queryParameters: T;
    public projectionBehavior: ProjectionBehavior;
    public waitForNonStaleResults: boolean;
    public waitForNonStaleResultsTimeout: number;

}
