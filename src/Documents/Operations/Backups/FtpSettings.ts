import { BackupSettings } from "./BackupSettings.js";

export interface FtpSettings extends BackupSettings {
    url: string;
    port?: number;
    userName?: string;
    password?: string;
    certificateAsBase64?: string;
    certificateFileName?: string;
}