import { PostgreSqlUser } from "./PostgreSqlUser.js";

export interface PostgreSqlAuthenticationConfiguration {
    users: PostgreSqlUser[];
}
