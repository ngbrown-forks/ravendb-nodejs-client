import { MoreLikeThisBase } from "./MoreLikeThisBase.js";

export class MoreLikeThisUsingDocument extends MoreLikeThisBase {
    public documentJson: string;

    constructor(documentJson: string) {
        super();
        this.documentJson = documentJson;
    }
}
