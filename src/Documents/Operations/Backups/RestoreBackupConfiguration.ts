import { RestoreBackupConfigurationBase } from "./RestoreBackupConfigurationBase.js";

export interface RestoreBackupConfiguration extends RestoreBackupConfigurationBase {
    backupLocation: string;

    type: "Local";
}
