import { IMoreLikeThisBuilderBase } from "./IMoreLikeThisBuilderBase.js";
import { IMoreLikeThisOperations } from "./IMoreLikeThisOperations.js";
import { IFilterDocumentQueryBase } from "../../Session/IFilterDocumentQueryBase.js";
import { IDocumentQuery } from "../../Session/IDocumentQuery.js";

export interface IMoreLikeThisBuilderForDocumentQuery<T extends object> extends IMoreLikeThisBuilderBase<T> {
    usingDocument(documentJson: string): IMoreLikeThisOperations<T>;

    usingDocument(builder: (query: IFilterDocumentQueryBase<T, IDocumentQuery<T>>) => IDocumentQuery<T>):
        IMoreLikeThisOperations<T>;

    usingAnyDocument(): IMoreLikeThisOperations<T>;
}
