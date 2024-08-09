import { BackupSettings } from "./BackupSettings.js";

export interface GoogleCloudSettings extends BackupSettings {

    bucketName: string;
    remoteFolderName: string;
    googleCredentialsJson: string;

}