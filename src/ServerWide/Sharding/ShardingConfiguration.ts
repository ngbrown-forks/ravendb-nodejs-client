import { OrchestratorConfiguration } from "./OrchestratorConfiguration.js";
import { DatabaseTopology } from "../Operations/index.js";
import { ShardBucketRange } from "./ShardBucketRange.js";
import { PrefixedShardingSetting } from "./PrefixedShardingSetting.js";
import { ShardBucketMigration } from "./ShardBucketMigration.js";

export interface ShardingConfiguration {
    orchestrator: OrchestratorConfiguration;
    shards: { [shard: number]: DatabaseTopology };
    bucketRanges: ShardBucketRange[];
    prefixed: PrefixedShardingSetting[];
    bucketMigrations: { [bucket: number]: ShardBucketMigration };
    migrationCutOffIndex: number;
    databaseId: string;
}