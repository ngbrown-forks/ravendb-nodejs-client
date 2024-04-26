import { DatabaseItemType } from "./DatabaseItemType.js";
import { DatabaseRecordItemType } from "./DatabaseRecordItemType.js";

export interface IDatabaseSmugglerOptions {
    operateOnTypes: DatabaseItemType[];
    includeExpired: boolean;
    removeAnalyzers: boolean;
    transformScript: string;
    maxStepsForTransformScript: number;
    skipRevisionCreation: boolean;
    collections: string[];
    operateOnDatabaseRecordType: DatabaseRecordItemType[];
}
