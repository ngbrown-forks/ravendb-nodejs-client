import { ConnectionString } from "../Etl/ConnectionString.js";
import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { AddQueueSinkOperationResult } from "./AddQueueSinkOperationResult.js";
import { QueueSinkConfiguration } from "./QueueSinkConfiguration.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";
import { Stream } from "node:stream";

export class AddQueueSinkOperation<T extends ConnectionString> implements IMaintenanceOperation<AddQueueSinkOperationResult> {
    private readonly _configuration: QueueSinkConfiguration;


    constructor(configuration: QueueSinkConfiguration) {
        this._configuration = configuration;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<AddQueueSinkOperationResult> {
        return new AddQueueSinkCommand(conventions, this._configuration);
    }
}

class AddQueueSinkCommand extends RavenCommand<AddQueueSinkOperationResult> implements IRaftCommand {
    private readonly _configuration: QueueSinkConfiguration;
    private readonly _conventions: DocumentConventions;


    constructor(conventions: DocumentConventions, configuration: QueueSinkConfiguration) {
        super();
        this._conventions = conventions;
        this._configuration = configuration;
    }

    get isReadRequest(): boolean {
        return false;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/admin/queue-sink";

        const headers = this._headers().typeAppJson().build();
        const body = this._serializer.serialize(this._configuration);

        return {
            method: "PUT",
            uri,
            body,
            headers
        };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        return this._parseResponseDefaultAsync(bodyStream);
    }

    getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}