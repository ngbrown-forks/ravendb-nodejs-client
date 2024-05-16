import { ReplicationBatchOptions, IndexBatchOptions } from "../../Session/IAdvancedSessionOperations.js";

export interface BatchOptions {
    replicationOptions: ReplicationBatchOptions;
    indexOptions: IndexBatchOptions;
    shardedOptions: ShardedBatchOptions;
}
