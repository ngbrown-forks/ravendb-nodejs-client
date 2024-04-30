import { ILazyOperation } from "./ILazyOperation.js";
import { ObjectTypeDescriptor } from "../../../../Types/index.js";
import { InMemoryDocumentSessionOperations } from "../../InMemoryDocumentSessionOperations.js";
import { GetRequest } from "../../../Commands/MultiGet/GetRequest.js";
import { throwError } from "../../../../Exceptions/index.js";
import { QueryResult } from "../../../Queries/QueryResult.js";
import { GetResponse } from "../../../Commands/MultiGet/GetResponse.js";
import { StatusCodes } from "../../../../Http/StatusCode.js";
import { ConditionalLoadResult } from "../../ConditionalLoadResult.js";
import { HEADERS } from "../../../../Constants.js";
import { QueryCommand } from "../../../Commands/QueryCommand.js";
import { stringToReadable } from "../../../../Utility/StreamUtil.js";
import { DocumentInfo } from "../../DocumentInfo.js";


export class LazyConditionalLoadOperation<T extends object> implements ILazyOperation {
    private readonly _clazz: ObjectTypeDescriptor<T>;
    private readonly _session: InMemoryDocumentSessionOperations;
    private readonly _id: string;
    private readonly _changeVector: string;

    public constructor(session: InMemoryDocumentSessionOperations, id: string, changeVector: string, clazz: ObjectTypeDescriptor<T>) {
        this._clazz = clazz;
        this._session = session;
        this._id = id;
        this._changeVector = changeVector;
    }

    public createRequest(): GetRequest {
        const request = new GetRequest();
        request.url = "/docs";
        request.method = "GET";
        request.query = "?id=" + encodeURIComponent(this._id);
        request.headers[HEADERS.IF_NONE_MATCH] = `"${this._changeVector}"`;
        return request;
    }

    private _result: any;
    private _requiresRetry: boolean;

    public get queryResult(): QueryResult {
        throwError("NotImplementedException");
        return null;
    }

    public get result(): any {
        return this._result;
    }

    public get requiresRetry() {
        return this._requiresRetry;
    }

    public async handleResponseAsync(response: GetResponse): Promise<void> {
        if (response.forceRetry) {
            this._result = null;
            this._requiresRetry = true;
            return;
        }

        switch (response.statusCode) {
            case StatusCodes.NotModified: {
                this._result = {
                    entity: null,
                    changeVector: this._changeVector
                } as ConditionalLoadResult<any>;
                return;
            }
            case StatusCodes.NotFound: {
                this._session.registerMissing(this._id);
                this._result = {
                    entity: null,
                    changeVector: null
                } as ConditionalLoadResult<any>;
                return;
            }
        }

        if (response.result) {
            const etag = response.headers[HEADERS.ETAG];

            const res = await QueryCommand.parseQueryResultResponseAsync(
                stringToReadable(response.result), this._session.conventions, false);
            const documentInfo = DocumentInfo.getNewDocumentInfo(res.results[0]);
            const r = this._session.trackEntity(this._clazz, documentInfo);

            this._result = {
                entity: r,
                changeVector: etag
            } as ConditionalLoadResult<any>;
            return;
        }

        this._result = null;
        this._session.registerMissing(this._id);
    }
}
