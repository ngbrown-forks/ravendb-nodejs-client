import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { StartBackupOperationResult } from "./StartBackupOperationResult.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { Stream } from "node:stream";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";

export class StartBackupOperation implements IMaintenanceOperation<StartBackupOperationResult> {
    private readonly _isFullBackup: boolean;
    private readonly _taskId: number;

    public constructor(isFullBackup: boolean, taskId: number) {
        this._isFullBackup = isFullBackup;
        this._taskId = taskId;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    public getCommand(conventions: DocumentConventions): RavenCommand<StartBackupOperationResult> {
        return new StartBackupCommand(this._isFullBackup, this._taskId);
    }
}

class StartBackupCommand extends RavenCommand<StartBackupOperationResult> {
    private readonly _isFullBackup: boolean;
    private readonly _taskId: number;

    public constructor(isFullBackup: boolean, taskId: number) {
        super();

        this._isFullBackup = isFullBackup;
        this._taskId = taskId;
    }

    get isReadRequest(): boolean {
        return true;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database
            + "/admin/backup/database?isFullBackup=" + (this._isFullBackup ? "true" : "false")
            + "&taskId=" + this._taskId;

        return {
            uri,
            method: "POST"
        }
    }

    async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        return this._parseResponseDefaultAsync(bodyStream);
    }
}