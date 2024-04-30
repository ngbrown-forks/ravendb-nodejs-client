import { PeriodicBackupConfiguration } from "../../../Documents/Operations/Backups/PeriodicBackupConfiguration.js";
import { IServerWideTask } from "../OngoingTasks/IServerWideTask.js";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ServerWideBackupConfiguration extends PeriodicBackupConfiguration, IServerWideTask {
}
