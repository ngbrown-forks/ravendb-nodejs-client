import { BackupSettings } from "./BackupSettings.js";

export interface AmazonSettings extends BackupSettings {
    awsAccessKey: string;
    awsSecretKey: string;
    awsSessionToken: string;
    awsRegionName: string;
    remoteFolderName: string;
}