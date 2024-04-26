import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { RefreshConfiguration } from "./RefreshConfiguration.js";
import { ConfigureRefreshOperationResult } from "./ConfigureRefreshOperationResult.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { Stream } from "node:stream";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";
import { throwError } from "../../../Exceptions/index.js";

export class ConfigureRefreshOperation implements IMaintenanceOperation<ConfigureRefreshOperationResult> {
    private readonly _configuration: RefreshConfiguration;

    public constructor(configuration: RefreshConfiguration) {
        if (!configuration) {
            throwError("InvalidArgumentException", "Configuration cannot be null");
        }
        this._configuration = configuration;
    }

    getCommand(conventions: DocumentConventions): RavenCommand<ConfigureRefreshOperationResult> {
        return new ConfigureRefreshCommand(this._configuration);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}

class ConfigureRefreshCommand extends RavenCommand<ConfigureRefreshOperationResult> implements IRaftCommand {
    private readonly _configuration: RefreshConfiguration;

    public constructor(configuration: RefreshConfiguration) {
        super();

        this._configuration = configuration;
    }

    get isReadRequest(): boolean {
        return false;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/admin/refresh/config";

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