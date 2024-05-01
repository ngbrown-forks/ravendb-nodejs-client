import { CONSTANTS } from "../../Constants.js";
import { StringUtil } from "../../Utility/StringUtil.js";
import { basename, extname, resolve } from "node:path";

export class BackupUtils {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {
        // empty
    }

    private static readonly LEGACY_INCREMENTAL_BACKUP_EXTENSION = ".ravendb-incremental-dump";
    private static readonly LEGACY_FULL_BACKUP_EXTENSION = ".ravendb-full-dump";

    public static BACKUP_FILE_SUFFIXES = [
        BackupUtils.LEGACY_INCREMENTAL_BACKUP_EXTENSION,
        BackupUtils.LEGACY_FULL_BACKUP_EXTENSION,
        CONSTANTS.Documents.PeriodicBackup.INCREMENTAL_BACKUP_EXTENSION,
        CONSTANTS.Documents.PeriodicBackup.ENCRYPTED_INCREMENTAL_BACKUP_EXTENSION,
        CONSTANTS.Documents.PeriodicBackup.FULL_BACKUP_EXTENSION,
        CONSTANTS.Documents.PeriodicBackup.ENCRYPTED_FULL_BACKUP_EXTENSION
    ];

    public static isFullBackupOrSnapshot(extension: string): boolean {
        return BackupUtils.isSnapshot(extension) || BackupUtils.isFullBackup(extension);
    }

    public static isFullBackup(extension: string): boolean {
        return StringUtil.equalsIgnoreCase(CONSTANTS.Documents.PeriodicBackup.FULL_BACKUP_EXTENSION, extension)
            || StringUtil.equalsIgnoreCase(CONSTANTS.Documents.PeriodicBackup.ENCRYPTED_FULL_BACKUP_EXTENSION, extension);
    }

    public static isSnapshot(extension: string) {
        return StringUtil.equalsIgnoreCase(CONSTANTS.Documents.PeriodicBackup.SNAPSHOT_EXTENSION, extension)
            || StringUtil.equalsIgnoreCase(CONSTANTS.Documents.PeriodicBackup.ENCRYPTED_FULL_BACKUP_EXTENSION, extension);
    }

    public static isIncrementalBackupFile(extension: string): boolean {
        return StringUtil.equalsIgnoreCase(CONSTANTS.Documents.PeriodicBackup.INCREMENTAL_BACKUP_EXTENSION, extension)
            || StringUtil.equalsIgnoreCase(CONSTANTS.Documents.PeriodicBackup.ENCRYPTED_INCREMENTAL_BACKUP_EXTENSION, extension)
            || StringUtil.equalsIgnoreCase(BackupUtils.LEGACY_INCREMENTAL_BACKUP_EXTENSION, extension);
    }

    public static comparator(o1: string, o2: string, mtimeProvider: (file: string) => number) {
        const baseName1 = basename(o1, extname(o1));
        const baseName2 = basename(o2, extname(o2));

        if (baseName1 !== baseName2) {
            return baseName1.localeCompare(baseName2);
        }

        const extension1 = extname(o1);
        const extension2 = extname(o2);

        if (extension1 !== extension2) {
            return periodicBackupFileExtensionComparator(o1, o2);
        }

        const lastModified1 = mtimeProvider(o1);
        const lastModified2 = mtimeProvider(o2);

        return lastModified1 - lastModified2;
    }

}

export function periodicBackupFileExtensionComparator(o1: string, o2: string) {
    if (resolve(o1) === resolve(o2)) {
        return 0;
    }

    if (StringUtil.equalsIgnoreCase(extname(o1), "." + CONSTANTS.Documents.PeriodicBackup.SNAPSHOT_EXTENSION)) {
        return -1;
    }

    if (StringUtil.equalsIgnoreCase(extname(o1), "." + CONSTANTS.Documents.PeriodicBackup.FULL_BACKUP_EXTENSION)) {
        return -1;
    }

    return 1;
}
