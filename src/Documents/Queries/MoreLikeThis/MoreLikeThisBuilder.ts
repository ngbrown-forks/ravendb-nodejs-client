import { IMoreLikeThisOperations } from "./IMoreLikeThisOperations.js";
import { IMoreLikeThisBuilderForDocumentQuery } from "./IMoreLikeThisBuilderForDocumentQuery.js";
import { IMoreLikeThisBuilderBase } from "./IMoreLikeThisBuilderBase.js";
import { MoreLikeThisBase } from "./MoreLikeThisBase.js";
import { MoreLikeThisOptions } from "./MoreLikeThisOptions.js";
import { MoreLikeThisUsingAnyDocument } from "./MoreLikeThisUsingAnyDocument.js";
import { MoreLikeThisUsingDocument } from "./MoreLikeThisUsingDocument.js";
import { TypeUtil } from "../../../Utility/TypeUtil.js";
import { MoreLikeThisUsingDocumentForDocumentQuery } from "./MoreLikeThisUsingDocumentForDocumentQuery.js";
import { IFilterDocumentQueryBase } from "../../Session/IFilterDocumentQueryBase.js";
import { IDocumentQuery } from "../../Session/IDocumentQuery.js";

export class MoreLikeThisBuilder<T extends object>
    implements IMoreLikeThisOperations<T>, IMoreLikeThisBuilderForDocumentQuery<T>, IMoreLikeThisBuilderBase<T> {

    private _moreLikeThis: MoreLikeThisBase;

    public getMoreLikeThis(): MoreLikeThisBase {
        return this._moreLikeThis;
    }

    public usingAnyDocument(): IMoreLikeThisOperations<T> {
        this._moreLikeThis = new MoreLikeThisUsingAnyDocument();

        return this;
    }

    public usingDocument(documentJson: string): IMoreLikeThisOperations<T>;
    public usingDocument(builder: (query: IFilterDocumentQueryBase<T, IDocumentQuery<T>>) => IDocumentQuery<T>):
        IMoreLikeThisOperations<T>;
    public usingDocument(
        documentJsonOrBuilder: string
            | ((query: IFilterDocumentQueryBase<T, IDocumentQuery<T>>) => IDocumentQuery<T>)):
        IMoreLikeThisOperations<T> {
        if (TypeUtil.isString(documentJsonOrBuilder)) {
            this._moreLikeThis = new MoreLikeThisUsingDocument(documentJsonOrBuilder as string);
        } else {
            const builder = documentJsonOrBuilder as
                (query: IFilterDocumentQueryBase<T, IDocumentQuery<T>>) => IDocumentQuery<T>;
            this._moreLikeThis = new MoreLikeThisUsingDocumentForDocumentQuery();
            (this._moreLikeThis as MoreLikeThisUsingDocumentForDocumentQuery<T>).forDocumentQuery = builder;
        }

        return this;
    }

    public withOptions(options: MoreLikeThisOptions): IMoreLikeThisOperations<T> {
        this._moreLikeThis.options = options;

        return this;
    }
}
