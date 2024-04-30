import { EtlConfiguration } from "../EtlConfiguration.js";
import { EtlType, OlapConnectionString } from "../ConnectionString.js";
import { OlapEtlFileFormat } from "./OlapEtlFileFormat.js";
import { OlapEtlTable } from "./OlapEtlTable.js";
import { DocumentConventions } from "../../../Conventions/DocumentConventions.js";

export class OlapEtlConfiguration extends EtlConfiguration<OlapConnectionString> {
    public runFrequency: string;
    public format: OlapEtlFileFormat;
    public customPartitionValue: string;
    public olapTables: OlapEtlTable[];

    public etlType: EtlType = "Olap";


    serialize(conventions: DocumentConventions): object {
        const result = super.serialize(conventions) as any;
        result.RunFrequency = this.runFrequency;
        result.Format = this.format;
        result.CustomPartitionValue = this.customPartitionValue;
        result.OlapTables = this.olapTables ? this.olapTables.map(this.serializeOlapTable) : null;
        result.EtlType = this.etlType;

        return result;
    }

    private serializeOlapTable(etlTable: OlapEtlTable) {
        return {
            TableName: etlTable.tableName,
            DocumentIdColumn: etlTable.documentIdColumn
        }
    }
}
