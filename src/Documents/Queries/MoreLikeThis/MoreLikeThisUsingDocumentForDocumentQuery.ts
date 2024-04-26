import { MoreLikeThisBase } from "./MoreLikeThisBase.js";
import { IFilterDocumentQueryBase } from "../../Session/IFilterDocumentQueryBase.js";
import { IDocumentQuery } from "../../Session/IDocumentQuery.js";

export class MoreLikeThisUsingDocumentForDocumentQuery<T extends object> extends MoreLikeThisBase {
    public forDocumentQuery: (query: IFilterDocumentQueryBase<T, IDocumentQuery<T>>) => IDocumentQuery<T>;
}
