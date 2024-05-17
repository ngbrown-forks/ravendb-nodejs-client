import { IDatabaseRecordBuilder } from "./IDatabaseRecordBuilder.js";
import { IShardedTopologyConfigurationBuilder } from "./IShardedTopologyConfigurationBuilder.js";
import { DatabaseRecord } from "../../index.js";

export interface IDatabaseRecordBuilderInitializer {
    regular(databaseName: string): IDatabaseRecordBuilder;
    sharded(databaseName: string, builder: (builder: IShardedTopologyConfigurationBuilder) => void): this;
    toDatabaseRecord(): DatabaseRecord;
}
