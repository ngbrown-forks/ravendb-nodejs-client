

export type ShardedBatchBehavior =
    /**
     * Do not force any behavior from the Client API and rely on Server's default
     */
    "Default"
    /**
     * Allow to perform batch commands only on a single bucket, commands will be performed on single shard with ACID transaction guarantees.
     * A transaction that contains changes that belong to multiple buckets will be rejected by the server.
     */
    | "TransactionalSingleBucketOnly"
    /**
     * Allow to spread batch commands to multiple buckets, commands can be performed on multiple shards without ACID transaction guarantees
     */
    | "NonTransactionalMultiBucket"