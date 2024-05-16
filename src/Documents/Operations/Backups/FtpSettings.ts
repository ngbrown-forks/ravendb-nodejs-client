import { BackupSettings } from "./BackupSettings.js";

export interface FtpSettings extends BackupSettings {
    url: string;
    userName?: string;
    password?: string;
    certificateAsBase64?: string;
}