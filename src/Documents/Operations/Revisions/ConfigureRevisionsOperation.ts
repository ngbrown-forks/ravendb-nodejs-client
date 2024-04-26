import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { RevisionsConfiguration } from "../RevisionsConfiguration.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { Stream } from "node:stream";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";
import { throwError } from "../../../Exceptions/index.js";

export class ConfigureRevisionsOperation implements IMaintenanceOperation<ConfigureRevisionsOperationResult> {
    private readonly _configuration: RevisionsConfiguration;

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    public constructor(configuration: RevisionsConfiguration) {
        if (!configuration) {
            throwError("InvalidArgumentException", "Configuration cannot be null");
        }
        this._configuration = configuration;
    }

    public getCommand(conventions: DocumentConventions): RavenCommand<ConfigureRevisionsOperationResult> {
        return new ConfigureRevisionsCommand(this._configuration);
    }
}

export class ConfigureRevisionsCommand extends RavenCommand<ConfigureRevisionsOperationResult> implements IRaftCommand {
    private readonly _configuration: RevisionsConfiguration;

    public constructor(configuration: RevisionsConfiguration) {
        super();
        this._configuration = configuration;
    }

    public get isReadRequest() {
        return false;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/admin/revisions/config";

        const body = JSON.stringify(this._configuration.toRemoteFieldNames(), null, 0);
        return {
            uri,
            method: "POST",
            body
        };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        let body: string = null;
        const results = await this._defaultPipeline(_ => body = _)
            .process(bodyStream);
        this.result = Object.assign(new ConfigureRevisionsOperationResult(), results);
        return body;
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}

export class ConfigureRevisionsOperationResult {
    public raftCommandIndex: number;
}
