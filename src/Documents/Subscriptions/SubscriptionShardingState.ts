
export interface SubscriptionShardingState {
    changeVectorForNextBatchStartingPointPerShard: Record<string, string>;
    nodeTagPerShard: Record<string, string>;
    processedChangeVectorPerBucket: Record<string, string>;
    changeVectorForNextBatchStartingPointForOrchestrator: string;
}
