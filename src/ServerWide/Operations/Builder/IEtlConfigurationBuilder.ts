import { RavenEtlConfiguration } from "../../../Documents/Operations/Etl/RavenEtlConfiguration.js";
import { SqlEtlConfiguration } from "../../../Documents/Operations/Etl/Sql/SqlEtlConfiguration.js";
import {
    ElasticSearchEtlConfiguration
} from "../../../Documents/Operations/Etl/ElasticSearch/ElasticSearchEtlConfiguration.js";
import { OlapEtlConfiguration } from "../../../Documents/Operations/Etl/Olap/OlapEtlConfiguration.js";
import { QueueConnectionString } from "../../../Documents/Operations/Etl/ConnectionString.js";

export interface IEtlConfigurationBuilder {
    addRavenEtl(configuration: RavenEtlConfiguration): this;
    addSqlEtl(configuration: SqlEtlConfiguration): this;
    addElasticSearchEtl(configuration: ElasticSearchEtlConfiguration): this;
    addOlapEtl(configuration: OlapEtlConfiguration): this;
    addQueueEtl(configuration: QueueConnectionString): this;
}
