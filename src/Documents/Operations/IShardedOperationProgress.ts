import { IOperationProgress } from "./IOperationProgress.js";

export interface IShardedOperationProgress extends IOperationProgress {
    shardNumber: number;
    nodeTag: string;
}