import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { IOperation, OperationResultType } from "../OperationAbstractions.js";
import { CompareExchangeValue } from "./CompareExchangeValue.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { HttpCache } from "../../../Http/HttpCache.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { IDocumentStore } from "../../IDocumentStore.js";
import { throwError } from "../../../Exceptions/index.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { CompareExchangeResultClass, ServerCasing, ServerResponse } from "../../../Types/index.js";
import { CompareExchangeValueResultParser, GetCompareExchangeValuesResponse } from "./CompareExchangeValueResultParser.js";
import { Stream } from "node:stream";
import { GetCompareExchangeValuesCommand } from "./GetCompareExchangeValuesOperation.js";

export class GetCompareExchangeValueOperation<T> implements IOperation<CompareExchangeValue<T>> {

    private readonly _key: string;
    private readonly _materializeMetadata: boolean;
    private readonly _clazz: CompareExchangeResultClass<T>;

    public constructor(key: string, clazz?: CompareExchangeResultClass<T>, materializeMetadata: boolean = true) {
        this._key = key;
        this._clazz = clazz;
        this._materializeMetadata = materializeMetadata;
    }

    public getCommand(
        store: IDocumentStore,
        conventions: DocumentConventions,
        cache: HttpCache): RavenCommand<CompareExchangeValue<T>> {
        return new GetCompareExchangeValueCommand<T>(this._key, this._materializeMetadata, conventions, this._clazz);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}

export class GetCompareExchangeValueCommand<T> extends RavenCommand<CompareExchangeValue<T>> {
    private readonly _key: string;
    private readonly _clazz: CompareExchangeResultClass<T>;
    private readonly _materializeMetadata: boolean;
    private readonly _conventions: DocumentConventions;

    public constructor(key: string, materializeMetadata: boolean, conventions: DocumentConventions, clazz?: CompareExchangeResultClass<T>) {
        super();

        if (!key) {
            throwError("InvalidArgumentException", "The key argument must have value");
        }

        this._key = key;
        this._clazz = clazz;
        this._materializeMetadata = materializeMetadata;
        this._conventions = conventions;
    }

    public get isReadRequest(): boolean {
        return true;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/cmpxchg?key=" + encodeURIComponent(this._key);
        return {uri};
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            return null;
        }

        let body: string = null;
        const results = await this._pipeline<ServerCasing<ServerResponse<GetCompareExchangeValuesResponse>>>()
            .collectBody(x => body = x)
            .parseJsonSync()
            .process(bodyStream);

        const localObject = GetCompareExchangeValuesCommand.mapToLocalObject(results);

        this.result = CompareExchangeValueResultParser.getValue(localObject, this._materializeMetadata, this._conventions, this._clazz);
        return body;
    }
}
