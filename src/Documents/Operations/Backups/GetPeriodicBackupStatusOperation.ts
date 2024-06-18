import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { GetPeriodicBackupStatusOperationResult } from "./GetPeriodicBackupStatusOperationResult.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { Stream } from "node:stream";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { PeriodicBackupStatus } from "./PeriodicBackupStatus.js";
import { ServerResponse } from "../../../Types/index.js";
import {
    BackupStatus,
    LocalBackup,
    UpdateToGoogleCloud,
    UploadToAzure,
    UploadToFtp, UploadToGlacier,
    UploadToS3
} from "./BackupStatus.js";

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
        const results = await this._defaultPipeline<ServerResponse<GetPeriodicBackupStatusOperationResult>>(_ => body = _)
            .process(bodyStream);


        this.result = {
            ...results,
            status: revivePeriodicBackupStatus(results.status, this._conventions)
        }

        if (this.result.isSharded) {
            throw new Error("Database is sharded, can't use GetPeriodicBackupStatusOperation. Use GetShardedPeriodicBackupStatusOperation instead.");
        }
        return body;
    }
}

export function revivePeriodicBackupStatus(status: ServerResponse<PeriodicBackupStatus>, conventions: DocumentConventions): PeriodicBackupStatus {
    return {
        ...status,
        lastFullBackup: conventions.dateUtil.parse(status.lastFullBackup),
        delayUntil: conventions.dateUtil.parse(status.delayUntil),
        originalBackupTime: conventions.dateUtil.parse(status.originalBackupTime),
        lastIncrementalBackup: conventions.dateUtil.parse(status.lastIncrementalBackup),
        lastFullBackupInternal: conventions.dateUtil.parse(status.lastFullBackupInternal),
        lastIncrementalBackupInternal: conventions.dateUtil.parse(status.lastIncrementalBackupInternal),
        localBackup: reviveUploadStatus<LocalBackup>(status.localBackup, conventions),
        error: status.error ? {
            ...status.error,
            at: conventions.dateUtil.parse(status.error.at)
        } : null,
        uploadToS3: reviveUploadStatus<UploadToS3>(status.uploadToS3, conventions),
        uploadToFtp: reviveUploadStatus<UploadToFtp>(status.uploadToFtp, conventions),
        updateToGoogleCloud: reviveUploadStatus<UpdateToGoogleCloud>(status.updateToGoogleCloud, conventions),
        uploadToAzure: reviveUploadStatus<UploadToAzure>(status.uploadToAzure, conventions),
        uploadToGlacier: reviveUploadStatus<UploadToGlacier>(status.uploadToGlacier, conventions)
    }
}

function reviveUploadStatus<T extends BackupStatus>(status: ServerResponse<T>, conventions: DocumentConventions): T {
    if (!status) {
        return null;
    }
    return {
        ...status,
        lastFullBackup: conventions.dateUtil.parse(status.lastFullBackup),
        lastIncrementalBackup: conventions.dateUtil.parse(status.lastIncrementalBackup),
    } as T;
}
