import { BackupSettings } from "./BackupSettings.js";

export interface LocalSettings extends BackupSettings {
    folderPath: string;
    shardNumber?: number;
}