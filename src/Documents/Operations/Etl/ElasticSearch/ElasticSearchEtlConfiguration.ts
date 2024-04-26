import { EtlConfiguration } from "../EtlConfiguration.js";
import { ElasticSearchConnectionString, EtlType } from "../ConnectionString.js";
import { ElasticSearchIndex } from "./ElasticSearchIndex.js";
import { DocumentConventions } from "../../../Conventions/DocumentConventions.js";

export class ElasticSearchEtlConfiguration extends EtlConfiguration<ElasticSearchConnectionString> {
    public elasticIndexes?: ElasticSearchIndex[];

    public etlType: EtlType = "ElasticSearch";

    serialize(conventions: DocumentConventions): object {
        const result = super.serialize(conventions) as any;

        result.EtlType = this.etlType;
        result.ElasticIndexes = this.elasticIndexes ? this.elasticIndexes.map(this.serializeSearchIndex) : null;

        return result;
    }

    private serializeSearchIndex(searchIndex: ElasticSearchIndex) {
        return {
            IndexName: searchIndex.indexName,
            DocumentIdProperty: searchIndex.documentIdProperty,
            InsertOnlyMode: searchIndex.insertOnlyMode
        }
    }
}
