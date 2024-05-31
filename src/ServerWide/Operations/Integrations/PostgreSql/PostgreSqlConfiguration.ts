import { PostgreSqlAuthenticationConfiguration } from "./PostgreSqlAuthenticationConfiguration.js";

export interface PostgreSqlConfiguration {
    authentication?: PostgreSqlAuthenticationConfiguration;
}
