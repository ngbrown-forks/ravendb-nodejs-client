import { IDatabaseSmugglerOptions } from "./IDatabaseSmugglerOptions.js";
import { ExportCompressionAlgorithm } from "./ExportCompressionAlgorithm.js";

export interface IDatabaseSmugglerExportOptions extends IDatabaseSmugglerOptions {
    collections: string[];
    compressionAlgorithm?: ExportCompressionAlgorithm;
}