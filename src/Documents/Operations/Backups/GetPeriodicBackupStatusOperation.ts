import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { GetPeriodicBackupStatusOperationResult } from "./GetPeriodicBackupStatusOperationResult.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { Stream } from "node:stream";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";

export class GetPeriodicBackupStatusOperation implements IMaintenanceOperation<GetPeriodicBackupStatusOperationResult> {
    private readonly _taskId: number;

    public constructor(taskId: number) {
        this._taskId = taskId;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    public getCommand(conventions: DocumentConventions): RavenCommand<GetPeriodicBackupStatusOperationResult> {
        return new GetPeriodicBackupStatusCommand(this._taskId, conventions);
    }
}

class GetPeriodicBackupStatusCommand extends RavenCommand<GetPeriodicBackupStatusOperationResult> {
    private readonly _taskId: number;
    private readonly _conventions: DocumentConventions;

    public constructor(taskId: number, conventions: DocumentConventions) {
        super();

        this._taskId = taskId;
        this._conventions = conventions;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/periodic-backup/status?name=" + node.database + "&taskId=" + this._taskId;

        return {
            method: "GET",
            uri
        }
    }

    get isReadRequest(): boolean {
        return true;
    }

    async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        let body: string = null;
        const results = await this._defaultPipeline(_ => body = _)
            .process(bodyStream);

        this.result = this._reviveResultTypes<GetPeriodicBackupStatusOperationResult>(
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
