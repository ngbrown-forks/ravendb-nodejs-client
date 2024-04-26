import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { IOperation, OperationResultType } from "../OperationAbstractions.js";
import { CompareExchangeResult, CompareExchangeResultResponse } from "./CompareExchangeResult.js";
import { CompareExchangeResultClass, ServerCasing, ServerResponse } from "../../../Types/index.js";
import { IDocumentStore } from "../../IDocumentStore.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { HttpCache } from "../../../Http/HttpCache.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { throwError } from "../../../Exceptions/index.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { Stream } from "node:stream";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";

export class DeleteCompareExchangeValueOperation<T> implements IOperation<CompareExchangeResult<T>> {

    private readonly _key: string;
    private readonly _index: number;
    private readonly _clazz: CompareExchangeResultClass<T>;

    public constructor(key: string, index: number, clazz?: CompareExchangeResultClass<T>) {
        this._key = key;
        this._index = index;
        this._clazz = clazz;
    }

    public getCommand(store: IDocumentStore, conventions: DocumentConventions, cache: HttpCache)
        : RavenCommand<CompareExchangeResult<T>> {
        return new RemoveCompareExchangeCommand(this._key, this._index, conventions, this._clazz);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

}

export class RemoveCompareExchangeCommand<T> extends RavenCommand<CompareExchangeResult<T>> implements IRaftCommand {
    private readonly _key: string;
    private readonly _index: number;
    private readonly _clazz: CompareExchangeResultClass<T>;
    private readonly _conventions: DocumentConventions;

    public constructor(key: string, index: number, conventions: DocumentConventions, clazz?: CompareExchangeResultClass<T>) {
        super();

        if (!key) {
            throwError("InvalidArgumentException", "The key argument must have value.");
        }

        this._clazz = clazz;
        this._key = key;
        this._index = index;
        this._conventions = conventions;
    }

    public get isReadRequest(): boolean {
        return true;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/cmpxchg?key=" + encodeURIComponent(this._key)
            + "&index=" + this._index;
        return {
            method: "DELETE",
            uri
        };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        let body: string = null;
        const resObj = await this._pipeline<ServerCasing<ServerResponse<CompareExchangeResultResponse>>>()
            .collectBody(_ => body = _)
            .parseJsonSync()
            .process(bodyStream);

        this.result = CompareExchangeResult.parseFromObject(resObj, this._conventions, this._clazz);
        return body;
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}
