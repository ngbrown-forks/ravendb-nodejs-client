import { DatabaseTopology } from "../index.js";
import { ITopologyConfigurationBuilder } from "./ITopologyConfigurationBuilder.js";

export interface IDatabaseRecordBuilder {
    withTopology(topology: DatabaseTopology): this;
    withTopology(builder: (builder: ITopologyConfigurationBuilder) => void): this;
    withReplicationFactor(replicationFactor: number): this;
}
