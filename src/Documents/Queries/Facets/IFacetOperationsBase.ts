import { Field } from "../../../Types/index.js";


export interface IFacetOperationsBase<T, TSelf> {
    withDisplayName(displayName: string): TSelf;

    sumOn(path: Field<T>): TSelf;
    sumOn(path: Field<T>, displayName: string): TSelf;

    minOn(path: Field<T>): TSelf;
    minOn(path: Field<T>, displayName: string): TSelf;

    maxOn(path: Field<T>): TSelf;
    maxOn(path: Field<T>, displayName: string): TSelf;

    averageOn(path: Field<T>): TSelf;
    averageOn(path: Field<T>, displayName: string): TSelf;
}