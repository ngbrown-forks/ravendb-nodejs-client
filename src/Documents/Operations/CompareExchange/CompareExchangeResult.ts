import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { throwError } from "../../../Exceptions/index.js";
import { CompareExchangeResultClass, ServerCasing, ServerResponse } from "../../../Types/index.js";
import { DocumentType } from "../../DocumentAbstractions.js";
import { CompareExchangeValueResultParser } from "./CompareExchangeValueResultParser.js";

export interface CompareExchangeResultResponse {
    index: number;
    successful: boolean;
    value: {
        object: object
    };
}

export class CompareExchangeResult<T> {

    public value: T;
    public index: number;
    public successful: boolean;

    public static parseFromObject<T>(
        response: ServerCasing<ServerResponse<CompareExchangeResultResponse>>,
        conventions: DocumentConventions,
        clazz?: CompareExchangeResultClass<T>): CompareExchangeResult<T> {
        if (!response.Index) {
            throwError("InvalidOperationException", "Response is invalid. Index is missing");
        }

        if (clazz) {
            conventions.tryRegisterJsType(clazz as DocumentType);
        }

        const raw = response.Value;
        const result = CompareExchangeValueResultParser.deserializeObject(raw, conventions, clazz);

        const exchangeResult = new CompareExchangeResult<T>();
        exchangeResult.index = response.Index;
        exchangeResult.successful = response.Successful;
        exchangeResult.value = result as T;

        return exchangeResult;
    }

}
