import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { UpdateQueueSinkOperationResult } from "./UpdateQueueSinkOperationResult.js";
import { ConnectionString } from "../Etl/ConnectionString.js";
import { QueueSinkConfiguration } from "./QueueSinkConfiguration.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { Stream } from "node:stream";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";

export class UpdateQueueSinkOperation<T extends ConnectionString> implements IMaintenanceOperation<UpdateQueueSinkOperationResult> {
    private readonly _taskId: number;
    private readonly _configuration: QueueSinkConfiguration;


    constructor(taskId: number, configuration: QueueSinkConfiguration) {
        this._taskId = taskId;
        this._configuration = configuration;
    }

    getCommand(conventions: DocumentConventions): RavenCommand<UpdateQueueSinkOperationResult> {
        return new UpdateQueueSinkCommand(conventions, this._taskId, this._configuration);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}


class UpdateQueueSinkCommand extends RavenCommand<UpdateQueueSinkOperationResult> implements IRaftCommand {
    private readonly _taskId: number;
    private readonly _configuration: QueueSinkConfiguration;
    private readonly _conventions: DocumentConventions;


    constructor(conventions: DocumentConventions, taskId: number, configuration: QueueSinkConfiguration) {
        super();
        this._taskId = taskId;
        this._configuration = configuration;
        this._conventions = conventions;
    }

    get isReadRequest(): boolean {
        return false;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/admin/queue-sink?id=" + this._taskId;

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
