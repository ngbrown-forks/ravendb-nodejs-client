import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { ExpirationConfiguration } from "./ExpirationConfiguration.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { Stream } from "node:stream";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";
import { throwError } from "../../../Exceptions/index.js";

export class ConfigureExpirationOperation implements IMaintenanceOperation<ConfigureExpirationOperationResult> {
    private readonly _configuration: ExpirationConfiguration;

    public constructor(configuration: ExpirationConfiguration) {
        this._configuration = configuration;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<ConfigureExpirationOperationResult> {
        return new ConfigureExpirationCommand(this._configuration);
    }
}

class ConfigureExpirationCommand extends RavenCommand<ConfigureExpirationOperationResult> implements IRaftCommand {
    private readonly _configuration: ExpirationConfiguration;

    public constructor(configuration: ExpirationConfiguration) {
        super();

        if (!configuration) {
            throwError("InvalidArgumentException", "Configuration cannot be null");
        }

        this._configuration = configuration;
    }

    get isReadRequest(): boolean {
        return false;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/admin/expiration/config";

        const body = this._serializer.serialize(this._configuration);

        return {
            uri,
            method: "POST",
            headers: this._headers().typeAppJson().build(),
            body
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

export interface ConfigureExpirationOperationResult {
    raftCommandIndex: number;
}