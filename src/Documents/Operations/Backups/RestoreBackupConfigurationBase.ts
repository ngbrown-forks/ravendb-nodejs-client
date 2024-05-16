import { BackupEncryptionSettings } from "./BackupEncryptionSettings.js";
import { RestoreType } from "./RestoreType.js";

export interface RestoreBackupConfigurationBase {
    databaseName: string;
    lastFileNameToRestore: string;
    dataDirectory: string;
    encryptionKey: string;
    disableOngoingTasks: boolean;
    skipIndexes: boolean;

    type: RestoreType;

    shardRestoreSettings: ShardedRestoreSettings;
    backupEncryptionSettings: BackupEncryptionSettings;
}