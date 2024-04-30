import { BackupSettings } from "./BackupSettings.js";

export interface AzureSettings extends BackupSettings {
    storageContainer?: string;
    remoteFolderName?: string;
    accountName?: string;
    accountKey?: string;
    sasToken?: string;
}