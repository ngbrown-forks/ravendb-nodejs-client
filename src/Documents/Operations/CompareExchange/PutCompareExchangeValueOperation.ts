import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { IOperation, OperationResultType } from "../OperationAbstractions.js";
import { CompareExchangeResult, CompareExchangeResultResponse } from "./CompareExchangeResult.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { IDocumentStore } from "../../IDocumentStore.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { HttpCache } from "../../../Http/HttpCache.js";
import { throwError } from "../../../Exceptions/index.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { JsonSerializer } from "../../../Mapping/Json/Serializer.js";
import { TypeUtil } from "../../../Utility/TypeUtil.js";
import { Stream } from "node:stream";
import { ObjectTypeDescriptor, CompareExchangeResultClass, ServerResponse, ServerCasing } from "../../../Types/index.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";
import { COMPARE_EXCHANGE, CONSTANTS } from "../../../Constants.js";
import { CompareExchangeSessionValue } from "./CompareExchangeSessionValue.js";
import { IMetadataDictionary } from "../../Session/IMetadataDictionary.js";

export class PutCompareExchangeValueOperation<T> implements IOperation<CompareExchangeResult<T>> {

    private readonly _key: string;
    private readonly _value: T;
    private readonly _index: number;
    private readonly _metadata: IMetadataDictionary;

    public constructor(key: string, value: T, index: number)
    public constructor(key: string, value: T, index: number, metadata: IMetadataDictionary)
    public constructor(key: string, value: T, index: number, metadata?: IMetadataDictionary) {
        this._key = key;
        this._value = value;
        this._index = index;
        this._metadata = metadata;
    }

    public getCommand(
        store: IDocumentStore,
        conventions: DocumentConventions,
        cache: HttpCache): RavenCommand<CompareExchangeResult<T>> {
        return new PutCompareExchangeValueCommand<T>(this._key, this._value, this._index, this._metadata, conventions);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}

export class PutCompareExchangeValueCommand<T> extends RavenCommand<CompareExchangeResult<T>> implements IRaftCommand {
    private readonly _key: string;
    private readonly _value: T;
    private readonly _index: number;
    private readonly _conventions: DocumentConventions;
    private readonly _metadata: IMetadataDictionary;

    public constructor(
        key: string,
        value: T,
        index: number,
        metadata: IMetadataDictionary,
        conventions: DocumentConventions) {
        super();

        if (!key) {
            throwError("InvalidArgumentException", "The key argument must have value");
        }

        if (index < 0) {
            throwError("InvalidArgumentException", "Index must be a non-negative number");
        }

        this._key = key;
        this._value = value;
        this._index = index;
        this._metadata = metadata;
        this._conventions = conventions || DocumentConventions.defaultConventions;
    }

    public get isReadRequest(): boolean {
        return false;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/cmpxchg?key=" + encodeURIComponent(this._key) + "&index=" + this._index;

        const tuple = {};
        tuple[COMPARE_EXCHANGE.OBJECT_FIELD_NAME] = TypeUtil.isPrimitive(this._value)
            ? this._value
            : this._conventions.transformObjectKeysToRemoteFieldNameConvention(this._value as any);

        if (this._metadata) {
            const metadata = CompareExchangeSessionValue.prepareMetadataForPut(this._key, this._metadata, this._conventions);
            tuple[CONSTANTS.Documents.Metadata.KEY] = metadata;
        }

        return {
            method: "PUT",
            uri,
            body: JsonSerializer.getDefault().serialize(tuple),
            headers: this._headers().typeAppJson().build()
        };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        let body: string = null;

        const resObj = await this._pipeline<ServerCasing<ServerResponse<CompareExchangeResultResponse>>>()
            .collectBody(_ => body = _)
            .parseJsonSync()
            .process(bodyStream);

        const type = !TypeUtil.isPrimitive(this._value)
            ? this._conventions.getTypeDescriptorByEntity(this._value as any) as ObjectTypeDescriptor
            : null;
        const clazz: CompareExchangeResultClass<T> = TypeUtil.isClass(type) ? type as any : null;
        this.result = CompareExchangeResult.parseFromObject(resObj, this._conventions, clazz);

        return body;
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}
