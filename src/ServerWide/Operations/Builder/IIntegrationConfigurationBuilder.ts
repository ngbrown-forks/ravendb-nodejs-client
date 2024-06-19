import { PostgreSqlConfiguration } from "../Integrations/PostgreSql/PostgreSqlConfiguration.js";

export interface IIntegrationConfigurationBuilder {
    configurePostgreSql(configuration: PostgreSqlConfiguration): this;
}
