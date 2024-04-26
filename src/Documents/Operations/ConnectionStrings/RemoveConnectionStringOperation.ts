import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { Stream } from "node:stream";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { ConnectionString } from "../Etl/ConnectionString.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";

export class RemoveConnectionStringOperation<T extends ConnectionString>
    implements IMaintenanceOperation<RemoveConnectionStringResult> {
    private readonly _connectionString: T;

    public constructor(connectionString: T) {
        this._connectionString = connectionString;
    }

    getCommand(conventions: DocumentConventions): RavenCommand<RemoveConnectionStringResult> {
        return new RemoveConnectionStringCommand(this._connectionString);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}

export class RemoveConnectionStringCommand<T extends ConnectionString>
    extends RavenCommand<RemoveConnectionStringResult>
    implements IRaftCommand {
    private readonly _connectionString: T;

    public constructor(connectionString: T) {
        super();

        this._connectionString = connectionString;
    }

    get isReadRequest(): boolean {
        return false;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/admin/connection-strings?connectionString="
            + encodeURIComponent(this._connectionString.name) + "&type=" + this._connectionString.type;

        return {
            method: "DELETE",
            uri
        }
    }

    async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        return this._parseResponseDefaultAsync(bodyStream);
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}

export interface RemoveConnectionStringResult {
    raftCommandIndex: number;
}
