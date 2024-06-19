import { SingleShardRestoreSetting } from "./SingleShardRestoreSetting.js";

export interface ShardedRestoreSettings {
    shards: Record<string, SingleShardRestoreSetting>;
}