import { Stream } from "node:stream";
import { IServerOperation, OperationResultType } from "../../Documents/Operations/OperationAbstractions.js";
import { throwError } from "../../Exceptions/index.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { HeadersBuilder } from "../../Utility/HttpUtil.js";
import { DocumentConventions } from "../../Documents/Conventions/DocumentConventions.js";
import { IRaftCommand } from "../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../Utility/RaftIdGenerator.js";
import { TypeUtil } from "../../Utility/TypeUtil.js";
import { ClientShardHelper } from "../../Utility/ClientShardHelper.js";

export interface DeleteDatabaseResult {
    raftCommandIndex: number;
    pendingDeletes: string[];
}

export interface DeleteDatabasesParameters {
    databaseNames: string[];
    hardDelete: boolean;
    shardNumber?: number;
    fromNodes?: string | string[];
    timeToWaitForConfirmation?: number;
}

export class DeleteDatabasesOperation implements IServerOperation<DeleteDatabaseResult> {

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    private readonly _parameters: DeleteDatabasesParameters;

    public constructor(parameters: DeleteDatabasesParameters) {
        if (!parameters) {
            throwError("InvalidArgumentException", "Parameters must be provided.");
        }

        if (!parameters.databaseNames || !parameters.databaseNames.length) {
            throwError("InvalidArgumentException", "Database names must be provided.");
        }

        this._parameters = parameters;

        if (!TypeUtil.isNullOrUndefined(parameters.shardNumber)) {
            this._parameters = {
                ...parameters,
                databaseNames: parameters.databaseNames.map(x => ClientShardHelper.toShardName(x, parameters.shardNumber))
            };
        }
    }

    public getCommand(conventions: DocumentConventions): RavenCommand<DeleteDatabaseResult> {
        return new DeleteDatabaseCommand(conventions, this._parameters);
    }
}

export class DeleteDatabaseCommand extends RavenCommand<DeleteDatabaseResult> implements IRaftCommand {
    private readonly _parameters: string;

    public constructor(conventions: DocumentConventions, parameters: DeleteDatabasesParameters) {
        super();

        if (!conventions) {
            throwError("InvalidArgumentException", "Conventions cannot be null");
        }

        if (!parameters) {
            throwError("InvalidArgumentException", "Parameters cannot be null.");
        }

        this._parameters = this._serializer.serialize(parameters);
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/admin/databases";
        return {
            uri,
            method: "DELETE",
            headers: HeadersBuilder.create()
                .typeAppJson()
                .build(),
            body: this._parameters,
        };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        let body: string = null;
        this.result = await this._defaultPipeline(x => body = x).process(bodyStream);
        return body;
    }

    public get isReadRequest() {
        return false;
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}
