import { BackupStatus } from "./BackupStatus.js";

export interface GoogleCloudSettings extends BackupStatus {

    bucketName: string;
    remoteFolderName: string;
    googleCredentialsJson: string;

}