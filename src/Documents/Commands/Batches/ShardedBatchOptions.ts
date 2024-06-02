import { ShardedBatchBehavior } from "../../Session/ShardedBatchBehavior.js";


export interface ShardedBatchOptions {
    batchBehavior: ShardedBatchBehavior;
}

export function forBehavior(behavior: ShardedBatchBehavior): ShardedBatchOptions {
    switch (behavior) {
        case "Default":
            return null;
        case "TransactionalSingleBucketOnly":
            return {
                batchBehavior: "TransactionalSingleBucketOnly"
            }
        case "NonTransactionalMultiBucket":
            return {
                batchBehavior: "NonTransactionalMultiBucket"
            }
    }
}