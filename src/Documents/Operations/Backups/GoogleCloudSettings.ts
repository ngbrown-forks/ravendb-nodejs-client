import { BackupSettings } from "./BackupSettings";

export interface GoogleCloudSettings extends BackupSettings {

    bucketName: string;
    remoteFolderName: string;
    googleCredentialsJson: string;

}