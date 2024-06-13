import { throwError } from "../../Exceptions/index.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { Stream } from "node:stream";
import { IServerOperation, OperationResultType } from "../../Documents/Operations/OperationAbstractions.js";
import { DatabasePutResult } from "./index.js";
import { DocumentConventions } from "../../Documents/Conventions/DocumentConventions.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { IRaftCommand } from "../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../Utility/RaftIdGenerator.js";
import { TypeUtil } from "../../Utility/TypeUtil.js";
import { Type } from "class-transformer";
import { ClientShardHelper } from "../../Utility/ClientShardHelper.js";

export class AddDatabaseNodeOperation implements IServerOperation<DatabasePutResult> {
    private readonly _databaseName: string;
    private readonly _node: string;

    public constructor(databaseName: string, node?: string)
    public constructor(databaseName: string, shardNumber: number, node?: string)
    public constructor(databaseName: string, nodeOrShardNumber?: string | number, node?: string) {

        if (!TypeUtil.isNullOrUndefined(nodeOrShardNumber) && TypeUtil.isNumber(nodeOrShardNumber)) {
            this._databaseName = ClientShardHelper.toShardName(databaseName, nodeOrShardNumber);
            this._node = node;
        } else {
            this._databaseName = databaseName;
            this._node = nodeOrShardNumber as string;
        }
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<DatabasePutResult> {
        return new AddDatabaseNodeCommand(this._databaseName, this._node);
    }
}

class AddDatabaseNodeCommand extends RavenCommand<DatabasePutResult> implements IRaftCommand {
    private readonly _databaseName: string;
    private readonly _node: string;

    public constructor(databaseName: string, node: string) {
        super();

        if (!databaseName) {
            throwError("InvalidArgumentException", "DatabaseName cannot be null");
        }

        this._databaseName = databaseName;
        this._node = node;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        let uri = node.url + "/admin/databases/node?name=" + this._databaseName;

        if (this._node) {
           uri += "&node=" + this._node;
        }

        return {
            uri,
            method: "PUT"
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
