import { IDatabaseSmugglerOptions } from "./IDatabaseSmugglerOptions.js";

export interface IDatabaseSmugglerImportOptions extends IDatabaseSmugglerOptions {
    skipRevisionCreation: boolean;
}
