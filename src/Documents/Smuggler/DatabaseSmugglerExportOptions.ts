import { DatabaseSmugglerOptions } from "./DatabaseSmugglerOptions.js";
import { IDatabaseSmugglerExportOptions } from "./IDatabaseSmugglerExportOptions.js";
import { ExportCompressionAlgorithm } from "./ExportCompressionAlgorithm.js";

export class DatabaseSmugglerExportOptions extends DatabaseSmugglerOptions implements IDatabaseSmugglerExportOptions {
    compressionAlgorithm?: ExportCompressionAlgorithm;
}
