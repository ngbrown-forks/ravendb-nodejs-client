import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { OngoingTaskType } from "./OngoingTaskType.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { Stream } from "node:stream";
import { ModifyOngoingTaskResult } from "../../../ServerWide/ModifyOnGoingTaskResult.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";

export class DeleteOngoingTaskOperation implements IMaintenanceOperation<ModifyOngoingTaskResult> {
    private readonly _taskId: number;
    private readonly _taskType: OngoingTaskType;

    public constructor(taskId: number, taskType: OngoingTaskType) {
        this._taskId = taskId;
        this._taskType = taskType;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<ModifyOngoingTaskResult> {
        return new DeleteOngoingTaskCommand(this._taskId, this._taskType);
    }
}

class DeleteOngoingTaskCommand extends RavenCommand<ModifyOngoingTaskResult> implements IRaftCommand {
    private readonly _taskId: number;
    private readonly _taskType: OngoingTaskType;

    public constructor(taskId: number, taskType: OngoingTaskType) {
        super();

        this._taskId = taskId;
        this._taskType = taskType;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/admin/tasks?id=" + this._taskId + "&type=" + this._taskType;

        return {
            uri,
            method: "DELETE"
        }
    }

    async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        return this._parseResponseDefaultAsync(bodyStream);
    }

    get isReadRequest(): boolean {
        return false;
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}