import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { ConnectionString } from "../Etl/ConnectionString.js";
import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { Stream } from "node:stream";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";
import { throwError } from "../../../Exceptions/index.js";

export interface PutConnectionStringResult {
    raftCommandIndex: number;
}

export class PutConnectionStringOperation<T extends ConnectionString>
    implements IMaintenanceOperation<PutConnectionStringResult> {

    private readonly _connectionString: T;

    public constructor(connectionString: T) {
        this._connectionString = connectionString;
    }

    public getCommand(conventions: DocumentConventions): RavenCommand<PutConnectionStringResult> {
        return new PutConnectionStringCommand(this._connectionString);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}

export class PutConnectionStringCommand<T extends ConnectionString>
    extends RavenCommand<PutConnectionStringResult> implements IRaftCommand {

    private readonly _connectionString: T;

    public constructor(connectionString: T) {
        super();
        if (!connectionString) {
            throwError("InvalidArgumentException", "ConnectionString cannot be null");
        }
        this._connectionString = connectionString;
    }

    public get isReadRequest(): boolean {
        return false;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/admin/connection-strings";

        const headers = this._headers()
            .typeAppJson()
            .build();
        const body = this._serializer.serialize(this._connectionString);
        return {
            method: "PUT",
            uri,
            headers,
            body
        };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        return this._parseResponseDefaultAsync(bodyStream);
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}
