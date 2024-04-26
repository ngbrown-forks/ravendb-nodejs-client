import { RestoreBackupConfigurationBase } from "./RestoreBackupConfigurationBase.js";
import { S3Settings } from "./S3Settings.js";

export interface RestoreFromS3Configuration extends RestoreBackupConfigurationBase {
    settings: S3Settings;
    type: "S3";
}