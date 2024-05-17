export interface DatabasePutResult {
    raftCommandIndex: number;
    name: string;
    topology: DatabaseTopology;
    nodesAddedTo: string[];
    shardsDefined: boolean;
}

export type DatabasePromotionStatus =
    | "WaitingForFirstPromotion"
    | "NotResponding"
    | "IndexNotUpToDate"
    | "ChangeVectorNotMerged"
    | "WaitingForResponse"
    | "Ok"
    | "OutOfCpuCredits"
    | "EarlyOutOfMemory"
    | "HighDirtyMemory"
    | "RaftIndexNotUpToDate";

export interface DatabaseTopology {
    members: string[];
    promotables: string[];
    rehabs: string[];
    predefinedMentors: { [key: string]: string };
    demotionReasons: { [key: string]: string };
    promotablesStatus: { [key: string]: DatabasePromotionStatus };
    replicationFactor: number;
    dynamicNodesDistribution: boolean;
    stamp: LeaderStamp;
    databaseTopologyIdBase64: string;
    clusterTransactionIdBase64: string;
    priorityOrder: string[];
    nodesModifiedAt: string;
}

export function getAllNodesFromTopology(topology: DatabaseTopology) {
    return [...topology.members, ...topology.promotables, ...topology.rehabs];
}

export interface LeaderStamp {
    index: number;
    term: number;
    leadersTicks: number;
}
