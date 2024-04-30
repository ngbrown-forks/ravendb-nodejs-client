import { IServerOperation, OperationResultType } from "../../../Documents/Operations/OperationAbstractions.js";
import { ServerWideExternalReplicationResponse } from "./ServerWideTaskResponse.js";
import { ServerWideExternalReplication } from "./ServerWideExternalReplication.js";
import { throwError } from "../../../Exceptions/index.js";
import { DocumentConventions } from "../../../Documents/Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { Stream } from "node:stream";

export class PutServerWideExternalReplicationOperation implements IServerOperation<ServerWideExternalReplicationResponse> {
    private readonly _configuration: ServerWideExternalReplication;

    public constructor(configuration: ServerWideExternalReplication) {
        if (!configuration) {
            throwError("InvalidArgumentException", "Configuration cannot be null");
        }

        this._configuration = configuration;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<ServerWideExternalReplicationResponse> {
        return new PutServerWideExternalReplicationCommand(this._configuration, conventions);
    }
}

class PutServerWideExternalReplicationCommand extends RavenCommand<ServerWideExternalReplicationResponse> implements IRaftCommand {

    private readonly _configuration: object;

    public constructor(configuration: ServerWideExternalReplication, conventions: DocumentConventions) {
        super();

        if (!configuration) {
            throwError("InvalidArgumentException", "Configuration cannot be null");
        }

        this._configuration = conventions.objectMapper.toObjectLiteral(configuration)
    }

    get isReadRequest(): boolean {
        return false;
    }

    getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/admin/configuration/server-wide/external-replication";

        const body = this._serializer.serialize(this._configuration);

        return {
            uri,
            method: "PUT",
            headers: this._headers().typeAppJson().build(),
            body
        }
    }

    async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        return this._parseResponseDefaultAsync(bodyStream);
    }
}