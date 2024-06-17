import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { IOperation, OperationResultType } from "../OperationAbstractions.js";
import { CompareExchangeValue } from "./CompareExchangeValue.js";
import { throwError } from "../../../Exceptions/index.js";
import { CompareExchangeResultClass, ServerCasing, ServerResponse } from "../../../Types/index.js";
import { IDocumentStore } from "../../IDocumentStore.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { HttpCache } from "../../../Http/HttpCache.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { CompareExchangeValueResultParser, GetCompareExchangeValuesResponse } from "./CompareExchangeValueResultParser.js";
import { Stream } from "node:stream";
import { StringBuilder } from "../../../Utility/StringBuilder.js";
import { TypeUtil } from "../../../Utility/TypeUtil.js";

export interface GetCompareExchangeValuesParameters<T> {
    keys?: string[];

    startWith?: string;
    start?: number;
    pageSize?: number;

    materializeMetadata?: boolean;

    clazz?: CompareExchangeResultClass<T>;
}

export class GetCompareExchangeValuesOperation<T> implements IOperation<{ [key: string]: CompareExchangeValue<T> }> {

    private readonly _clazz: CompareExchangeResultClass<T>;
    private readonly _keys: string[];

    private readonly _startWith: string;
    private readonly _start: number;
    private readonly _pageSize: number;

    private readonly _materializeMetadata: boolean;

    public get keys(): string[] {
        return this._keys;
    }

    public get startWith(): string {
        return this._startWith;
    }

    public get start(): number {
        return this._start;
    }

    public get pageSize(): number {
        return this._pageSize;
    }

    public get clazz(): CompareExchangeResultClass<T> {
        return this._clazz;
    }

    public constructor(parameters: GetCompareExchangeValuesParameters<T>) {
        this._clazz = parameters.clazz;
        this._materializeMetadata = parameters.materializeMetadata || true;

        if (parameters.keys) {
            if (!parameters.keys.length) {
                throwError("InvalidArgumentException", "Keys cannot be an empty array.");
            }

            this._keys = parameters.keys;
        } else if (!TypeUtil.isNullOrUndefined(parameters.startWith)) {
            this._startWith = parameters.startWith;
            this._start = parameters.start;
            this._pageSize = parameters.pageSize;
        } else {
            throwError("InvalidArgumentException", "Please specify at least keys or startWith parameter");
        }
    }

    public getCommand(store: IDocumentStore, conventions: DocumentConventions, cache: HttpCache)
        : RavenCommand<{ [key: string]: CompareExchangeValue<T> }> {
        return new GetCompareExchangeValuesCommand(this, this._materializeMetadata, conventions);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}

export class GetCompareExchangeValuesCommand<T> extends RavenCommand<{ [key: string]: CompareExchangeValue<T> }> {
    private _operation: GetCompareExchangeValuesOperation<T>;
    private readonly _materializeMetadata: boolean;
    private readonly _conventions: DocumentConventions;

    public constructor(operation: GetCompareExchangeValuesOperation<T>, materializeMetadata: boolean, conventions: DocumentConventions) {
        super();
        this._operation = operation;
        this._materializeMetadata = materializeMetadata;
        this._conventions = conventions;
    }

    public get isReadRequest(): boolean {
        return true;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const pathBuilder = new StringBuilder(node.url);

        pathBuilder.append("/databases/")
            .append(node.database)
            .append("/cmpxchg?");

        if (this._operation.keys) {
            for (const key of this._operation.keys) {
                pathBuilder.append("&key=").append(encodeURIComponent(key));
            }
        } else {
            if (this._operation.startWith) {
                pathBuilder.append("&startsWith=")
                    .append(encodeURIComponent(this._operation.startWith));
            }

            if (this._operation.start) {
                pathBuilder.append("&start=")
                    .append(this._operation.start);
            }

            if (this._operation.pageSize) {
                pathBuilder.append("&pageSize=")
                    .append(this._operation.pageSize);
            }
        }

        const uri = pathBuilder.toString();

        return { uri };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        let body: string = null;

        if (!bodyStream) {
            this.result = {};
            return body;
        }

        const results = await this._pipeline<ServerCasing<ServerResponse<GetCompareExchangeValuesResponse>>>()
            .collectBody(b => body = b)
            .parseJsonSync()
            .process(bodyStream);

        const localObject = GetCompareExchangeValuesCommand.mapToLocalObject(results);

        this.result = CompareExchangeValueResultParser.getValues<T>(
            localObject, this._materializeMetadata, this._conventions, this._operation.clazz);

        return body;
    }

    public static mapToLocalObject(json: ServerCasing<ServerResponse<GetCompareExchangeValuesResponse>>): GetCompareExchangeValuesResponse {
        return {
            results: json.Results.map(item => {
                if (!item.Value) {
                    return {
                        changeVector: item.ChangeVector,
                        index: item.Index,
                        key: item.Key,
                        value: null
                    }
                }

                return {
                    value: item.Value,
                    index: item.Index,
                    key: item.Key,
                    changeVector: item.ChangeVector
                }
            })
        }
    }
}
