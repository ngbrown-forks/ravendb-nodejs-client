import { IMaintenanceOperation, OperationResultType } from "../../OperationAbstractions.js";
import { AbstractGetPeriodicBackupStatusOperationResult } from "../AbstractGetPeriodicBackupStatusOperationResult.js";
import { PeriodicBackupStatus } from "../PeriodicBackupStatus.js";
import { DocumentConventions } from "../../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../../Http/RavenCommand.js";
import { ServerNode } from "../../../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../../../Primitives/Http.js";
import { Stream } from "node:stream";
import { ServerResponse } from "../../../../Types/index.js";
import { revivePeriodicBackupStatus } from "../GetPeriodicBackupStatusOperation.js";

export class GetShardedPeriodicBackupStatusOperation implements IMaintenanceOperation<GetShardedPeriodicBackupStatusOperationResult> {
    private readonly _taskId: number;

    constructor(taskId: number) {
        this._taskId = taskId;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<GetShardedPeriodicBackupStatusOperationResult> {
        return new GetShardedPeriodicBackupStatusCommand(this._taskId, conventions);
    }
}

class GetShardedPeriodicBackupStatusCommand extends RavenCommand<GetShardedPeriodicBackupStatusOperationResult> {
    private readonly _taskId: number;
    private readonly _conventions: DocumentConventions;

    constructor(taskId: number, conventions: DocumentConventions) {
        super();
        this._taskId = taskId;
        this._conventions = conventions;
    }

    get isReadRequest(): boolean {
        return true;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/periodic-backup/status?name=" + node.database + "&taskId=" + this._taskId;
        return {
            uri,
            method: "GET"
        }
    }

    async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        let body: string = null;
        const results = await this._defaultPipeline<ServerResponse<GetShardedPeriodicBackupStatusOperationResult>>(_ => body = _)
            .process(bodyStream);

        this.result = {
            ...results,
            statuses: reviveStatuses(results.statuses, this._conventions)
        }

        if (!this.result.isSharded) {
            throw new Error("Database is sharded, can't use GetPeriodicBackupStatusOperation. Use GetShardedPeriodicBackupStatusOperation instead.");
        }
        return body;
    }
}

export interface GetShardedPeriodicBackupStatusOperationResult extends AbstractGetPeriodicBackupStatusOperationResult {
    statuses: Record<number, PeriodicBackupStatus>;
}

function reviveStatuses(statuses: Record<number, ServerResponse<PeriodicBackupStatus>>, conventions: DocumentConventions): Record<number, PeriodicBackupStatus> {
    if (!statuses) {
        return null;
    }
    const result = {} as Record<string, PeriodicBackupStatus>;

    Object.entries(statuses).map(entry => {
        result[entry[0]] = revivePeriodicBackupStatus(entry[1], conventions);
    });

    return result;
}