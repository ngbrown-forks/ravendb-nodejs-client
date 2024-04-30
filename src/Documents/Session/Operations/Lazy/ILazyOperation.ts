import { GetRequest } from "../../../Commands/MultiGet/GetRequest.js";
import { GetResponse } from "../../../Commands/MultiGet/GetResponse.js";
import { QueryResult } from "../../../Queries/QueryResult.js";

export interface ILazyOperation {
    result: any;
    queryResult: QueryResult;
    requiresRetry: boolean;

    createRequest(): GetRequest;

    handleResponseAsync(response: GetResponse): Promise<void>;
}
