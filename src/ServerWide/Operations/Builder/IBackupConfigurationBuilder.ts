import { PeriodicBackupConfiguration } from "../../../Documents/Operations/Backups/PeriodicBackupConfiguration.js";

export interface IBackupConfigurationBuilder {
    addPeriodicBackup(configuration: PeriodicBackupConfiguration): this;
}
