import { IDatabaseSmugglerImportOptions } from "./IDatabaseSmugglerImportOptions.js";
import { DatabaseSmugglerOptions } from "./DatabaseSmugglerOptions.js";

export class DatabaseSmugglerImportOptions extends DatabaseSmugglerOptions implements IDatabaseSmugglerImportOptions {

    constructor()
    constructor(options: DatabaseSmugglerOptions)
    constructor(options?: DatabaseSmugglerOptions) {
        super();

        if (options) {
            this.includeExpired = options.includeExpired;
            this.includeArtificial = options.includeArtificial;
            this.maxStepsForTransformScript = options.maxStepsForTransformScript;
            this.operateOnTypes = [ ... options.operateOnTypes ];
            this.removeAnalyzers = options.removeAnalyzers;
            this.transformScript = options.transformScript;
        }
    }
}