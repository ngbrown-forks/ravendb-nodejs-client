import { PeriodicBackupStatus } from "./PeriodicBackupStatus.js";
import { AbstractGetPeriodicBackupStatusOperationResult } from "./AbstractGetPeriodicBackupStatusOperationResult.js";

export interface GetPeriodicBackupStatusOperationResult extends AbstractGetPeriodicBackupStatusOperationResult {
    status: PeriodicBackupStatus;
}
