import {
    ElasticSearchConnectionString,
    OlapConnectionString, QueueConnectionString,
    RavenConnectionString,
    SqlConnectionString
} from "../../../Documents/Operations/Etl/ConnectionString.js";

export interface IConnectionStringConfigurationBuilder {
    addRavenConnectionString(connectionString: RavenConnectionString): this;
    addSqlConnectionString(connectionString: SqlConnectionString): this;
    addOlapConnectionString(connectionString: OlapConnectionString): this;
    addElasticSearchConnectionString(connectionString: ElasticSearchConnectionString): this;
    addQueueConnectionString(connectionString: QueueConnectionString): this;
}
