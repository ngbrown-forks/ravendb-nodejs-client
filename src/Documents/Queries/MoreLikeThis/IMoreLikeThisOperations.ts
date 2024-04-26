import { MoreLikeThisOptions } from "./MoreLikeThisOptions.js";

export interface IMoreLikeThisOperations<T> {
    withOptions(options: MoreLikeThisOptions): IMoreLikeThisOperations<T>;
}
