import { GroupByField } from "./GroupByField.js";
import { IDocumentQuery } from "./IDocumentQuery.js";
import { IFilterFactory } from "../Queries/IFilterFactory.js";

export interface IGroupByDocumentQuery<T extends object> {

    selectKey(): IGroupByDocumentQuery<T>;
    selectKey(fieldName: string): IGroupByDocumentQuery<T>;
    selectKey(fieldName: string, projectedName: string): IGroupByDocumentQuery<T>;

    selectSum(field: GroupByField, ...fields: GroupByField[]): IDocumentQuery<T>;

    selectCount(): IDocumentQuery<T>;
    selectCount(projectedName: string): IDocumentQuery<T>;

    filter(builder: (factory: IFilterFactory<T>) => void): IGroupByDocumentQuery<T>;
    filter(builder: (factory: IFilterFactory<T>) => void, limit: number): IGroupByDocumentQuery<T>;
}
