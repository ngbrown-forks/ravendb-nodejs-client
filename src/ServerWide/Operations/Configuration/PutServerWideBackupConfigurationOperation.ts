import { IServerOperation, OperationResultType } from "../../../Documents/Operations/OperationAbstractions.js";
import { ServerWideBackupConfiguration } from "./ServerWideBackupConfiguration.js";
import { throwError } from "../../../Exceptions/index.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { DocumentConventions } from "../../../Documents/Conventions/DocumentConventions.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { Stream } from "node:stream";
import {
    PutServerWideBackupConfigurationResponse
} from "../OngoingTasks/ServerWideTaskResponse.js";

export class PutServerWideBackupConfigurationOperation implements IServerOperation<PutServerWideBackupConfigurationResponse> {
    private readonly _configuration: ServerWideBackupConfiguration;

    public constructor(configuration: ServerWideBackupConfiguration) {
        if (!configuration) {
            throwError("InvalidArgumentException", "Configuration cannot be null");
        }

        this._configuration = configuration;
    }

    getCommand(conventions: DocumentConventions): RavenCommand<PutServerWideBackupConfigurationResponse> {
        return new PutServerWideBackupConfigurationCommand(this._configuration);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}

class PutServerWideBackupConfigurationCommand extends RavenCommand<PutServerWideBackupConfigurationResponse> implements IRaftCommand {
    private readonly _configuration: ServerWideBackupConfiguration;

    public constructor(configuration: ServerWideBackupConfiguration) {
        super();

        if (!configuration) {
            throwError("InvalidArgumentException", "Configuration cannot be null");
        }

        this._configuration = configuration;
    }

    get isReadRequest(): boolean {
        return false;
    }

    getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/admin/configuration/server-wide/backup";

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
