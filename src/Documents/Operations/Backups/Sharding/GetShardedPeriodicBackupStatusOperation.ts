import { IMaintenanceOperation, OperationResultType } from "../../OperationAbstractions.js";
import { AbstractGetPeriodicBackupStatusOperationResult } from "../AbstractGetPeriodicBackupStatusOperationResult.js";
import { PeriodicBackupStatus } from "../PeriodicBackupStatus.js";
import { DocumentConventions } from "../../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../../Http/RavenCommand.js";
import { ServerNode } from "../../../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../../../Primitives/Http.js";
import { Stream } from "node:stream";
import { GetPeriodicBackupStatusOperationResult } from "../GetPeriodicBackupStatusOperationResult.js";

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
        const results = await this._defaultPipeline(_ => body = _)
            .process(bodyStream);

        this.result = this._reviveResultTypes<GetShardedPeriodicBackupStatusOperationResult>(
            results,
            this._conventions,
            {
                nestedTypes: {
                    "status.lastFullBackup": "date",
                    "status.delayUntil": "date",
                    "status.originalBackupTime": "date",
                    "status.lastIncrementalBackup": "date",
                    "status.lastFullBackupInternal": "date",
                    "status.lastIncrementalBackupInternal": "date",
                    "status.localBackup.lastIncrementalBackup": "date",
                    "status.localBackup.lastFullBackup": "date",
                    "status.nextBackup.dateTime": "date",
                    "status.nextBackup.originalBackupTime": "date",
                    "status.onGoingBackup.startTime": "date",
                    "status.error.at": "date"
                }
            });

        if (this.result.isSharded) {
            throw new Error("Database is sharded, can't use GetPeriodicBackupStatusOperation. Use GetShardedPeriodicBackupStatusOperation instead.");
        }
        return body;
    }
}

export interface GetShardedPeriodicBackupStatusOperationResult extends AbstractGetPeriodicBackupStatusOperationResult {
    statuses: Record<number, PeriodicBackupStatus>;
}