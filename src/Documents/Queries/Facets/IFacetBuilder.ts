import { RangeBuilder } from "./RangeBuilder.js";
import { IFacetOperations } from "./IFacetOperations.js";
import { Field } from "../../../Types/index.js";

export interface IFacetBuilder<T> {
    byRanges(range: RangeBuilder<any>, ...ranges: RangeBuilder<any>[]): IFacetOperations<T>;

    byField(fieldName: Field<T>): IFacetOperations<T>;

    allResults(): IFacetOperations<T>;

    // TBD IFacetOperations<T> ByField(Expression<Func<T, object>> path);
    // TBD IFacetOperations<T> ByRanges(Expression<Func<T, bool>> path, params Expression<Func<T, bool>>[] paths);
}
