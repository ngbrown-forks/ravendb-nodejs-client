import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { ConfigureDataArchivalOperationResult } from "./ConfigureDataArchivalOperationResult.js";
import { DataArchivalConfiguration } from "./DataArchivalConfiguration.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { Stream } from "node:stream";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";

export class ConfigureDataArchivalOperation implements IMaintenanceOperation<ConfigureDataArchivalOperationResult> {
    private readonly _configuration: DataArchivalConfiguration;

    constructor(configuration: DataArchivalConfiguration) {
        this._configuration = configuration;
    }

    getCommand(conventions: DocumentConventions): RavenCommand<ConfigureDataArchivalOperationResult> {
        return new ConfigureDataArchivalCommand(conventions, this._configuration);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}

class ConfigureDataArchivalCommand extends RavenCommand<ConfigureDataArchivalOperationResult> {
    private readonly _conventions: DocumentConventions;
    private readonly _configuration: DataArchivalConfiguration;


    constructor(conventions: DocumentConventions, configuration: DataArchivalConfiguration) {
        super();
        this._conventions = conventions;
        this._configuration = configuration;
    }

    get isReadRequest(): boolean {
        return false;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/admin/data-archival/config";

        const headers = this._headers()
            .typeAppJson()
            .build();

        const body = this._serializer.serialize(this._configuration);

        return {
            method: "POST",
            uri,
            headers,
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
