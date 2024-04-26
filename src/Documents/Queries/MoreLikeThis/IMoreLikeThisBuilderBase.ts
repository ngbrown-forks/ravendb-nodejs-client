import { IMoreLikeThisOperations } from "./IMoreLikeThisOperations.js";

export interface IMoreLikeThisBuilderBase<T extends object> {
    usingAnyDocument(): IMoreLikeThisOperations<T>;

    usingDocument(documentJson: string): IMoreLikeThisOperations<T>;
}
