import { GetBackupConfigurationScript } from "./GetBackupConfigurationScript.js";

export interface BackupSettings {
    disabled?: boolean;
    getBackupConfigurationScript?: GetBackupConfigurationScript;
}