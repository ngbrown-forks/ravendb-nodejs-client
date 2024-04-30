import { IDisposable } from "../../../Types/Contracts.js";
import { MoreLikeThisToken } from "../../Session/Tokens/MoreLikeThisToken.js";
import { MoreLikeThisOptions } from "./MoreLikeThisOptions.js";
import { ObjectUtil } from "../../../Utility/ObjectUtil.js";

export class MoreLikeThisScope implements IDisposable {

    private readonly _token: MoreLikeThisToken;
    private readonly _addQueryParameter: (value: object | string) => string;
    private readonly _onDispose: () => void;

    public constructor(token: MoreLikeThisToken, addQueryParameter: (value: any) => string, onDispose: () => void) {
        this._token = token;
        this._addQueryParameter = addQueryParameter;
        this._onDispose = onDispose;
    }

    public dispose(): void {
        if (this._onDispose) {
            this._onDispose();
        }
    }

    public withOptions(options: MoreLikeThisOptions) {
        if (!options) {
            return;
        }

        const optionsAsJson = ObjectUtil.transformObjectKeys(options, { defaultTransform: ObjectUtil.pascal });
        this._token.optionsParameterName = this._addQueryParameter(optionsAsJson);
    }

    public withDocument(document: string): void {
        this._token.documentParameterName = this._addQueryParameter(document);
    }

}
