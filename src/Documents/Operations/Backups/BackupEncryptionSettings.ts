import { EncryptionMode } from "./Enums.js";

export interface BackupEncryptionSettings {
    key: string;
    encryptionMode: EncryptionMode;
}