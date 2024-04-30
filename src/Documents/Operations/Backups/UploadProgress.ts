import { UploadType } from "./BackupStatus.js";
import { UploadState } from "./UploadState.js";

export interface UploadProgress {
    uploadType: UploadType;
    uploadState: UploadState;
    uploadedInBytes: number;
    totalInBytes: number;
    bytesPutsPerSec: number;
    uploadTimeInMs: number;
}
