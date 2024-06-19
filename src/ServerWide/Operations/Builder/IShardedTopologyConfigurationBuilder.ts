import { OrchestratorTopology } from "../../OrchestratorTopology.js";
import { DatabaseTopology } from "../index.js";
import { IOrchestratorTopologyConfigurationBuilder } from "./IOrchestratorTopologyConfigurationBuilder.js";
import { IShardTopologyConfigurationBuilder } from "./IShardTopologyConfigurationBuilder.js";

export interface IShardedTopologyConfigurationBuilder {
    orchestrator(topology: OrchestratorTopology): this;
    orchestrator(builder: (builder: IOrchestratorTopologyConfigurationBuilder) => void): this;
    addShard(shardNumber: number, topology: DatabaseTopology): this;
    addShard(shardNumber: number, builder: (builder: IShardTopologyConfigurationBuilder) => void): this;
}

