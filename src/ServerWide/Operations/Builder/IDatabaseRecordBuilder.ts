import { DatabaseTopology } from "../index.js";
import { ITopologyConfigurationBuilder } from "./ITopologyConfigurationBuilder.js";
import { IDatabaseRecordBuilderBase } from "./IDatabaseRecordBuilderBase.js";

export interface IDatabaseRecordBuilder extends IDatabaseRecordBuilderBase {
    withTopology(topology: DatabaseTopology): this;
    withTopology(builder: (builder: ITopologyConfigurationBuilder) => void): this;
    withReplicationFactor(replicationFactor: number): this;
}
