import { throwError } from "../../Exceptions/index.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { Stream } from "node:stream";
import { IServerOperation, OperationResultType } from "../../Documents/Operations/OperationAbstractions.js";
import { DatabasePutResult } from "./index.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { DocumentConventions } from "../../Documents/Conventions/DocumentConventions.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { IRaftCommand } from "../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../Utility/RaftIdGenerator.js";
import { ClientShardHelper } from "../../Utility/ClientShardHelper.js";

export class PromoteDatabaseNodeOperation implements IServerOperation<DatabasePutResult> {
    private _databaseName: string;
    private readonly _node: string;

    public constructor(databaseName: string, node: string)
    public constructor(databaseName: string, node: string, shardNumber: number)
    public constructor(databaseName: string, node: string, shardNumber?: number) {
        this._node = node;
        this._databaseName = ClientShardHelper.toShardName(databaseName, shardNumber);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<DatabasePutResult> {
        return new PromoteDatabaseNodeCommand(this._databaseName, this._node);
    }
}

class PromoteDatabaseNodeCommand extends RavenCommand<DatabasePutResult> implements IRaftCommand {
    private readonly _databaseName: string;
    private readonly _node: string;

    public constructor(databaseName: string, node: string) {
        super();

        if (!databaseName) {
            throwError("InvalidArgumentException", "DatabaseName cannot be null");
        }

        if (!node) {
            throwError("InvalidArgumentException", "Node cannot be null");
        }

        this._databaseName = databaseName;
        this._node = node;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/admin/databases/promote?name=" + this._databaseName + "&node=" + this._node;

        return {
            uri,
            method: "POST"
        }
    }

    async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        return this._parseResponseDefaultAsync(bodyStream);
    }

    get isReadRequest(): boolean {
        return false;
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}
