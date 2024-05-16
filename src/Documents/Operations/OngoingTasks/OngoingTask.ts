import { NodeId } from "../../Subscriptions/NodeId.js";
import { RunningBackup } from "./RunningBackup.js";
import { NextBackup } from "./NextBackup.js";
import { OngoingTaskType } from "./OngoingTaskType.js";
import { BackupType } from "../Backups/Enums.js";
import { RavenEtlConfiguration } from "../Etl/RavenEtlConfiguration.js";
import { SqlEtlConfiguration } from "../Etl/Sql/SqlEtlConfiguration.js";
import { RetentionPolicy } from "../Backups/RetentionPolicy.js";
import { ElasticSearchEtlConfiguration } from "../Etl/ElasticSearch/ElasticSearchEtlConfiguration.js";
import { OlapEtlConfiguration } from "../Etl/Olap/OlapEtlConfiguration.js";
import { QueueEtlConfiguration } from "../Etl/Queue/QueueEtlConfiguration.js";

export interface OngoingTask {
    taskId: number;
    taskType: OngoingTaskType;
    responsibleNode: NodeId;
    taskState: OngoingTaskState;
    taskConnectionStatus: OngoingTaskConnectionStatus;
    taskName: string;
    error: string;
    mentorNode: string;
}

export interface OngoingTaskBackup extends OngoingTask {
    taskType: "Backup",
    backupType: BackupType;
    backupDestinations: string[];
    lastFullBackup: Date;
    lastIncrementalBackup: Date;
    onGoingBackup: RunningBackup;
    nextBackup: NextBackup;
    retentionPolicy: RetentionPolicy;
    isEncrypted: boolean;
    lastExecutingNodeTag: string;
}

export type OngoingTaskConnectionStatus =
    "None"
    | "Active"
    | "NotActive"
    | "Reconnect"
    | "NotOnThisNode";

export interface OngoingTaskRavenEtlDetails extends OngoingTask {
    taskType: "RavenEtl",
    destinationUrl: string;
    configuration: RavenEtlConfiguration;
}

export interface OngoingTaskReplication extends OngoingTask {
    taskType: "Replication",
    destinationUrl: string;
    topologyDiscoveryUrls: string[];
    destinationDatabase: string;
    connectionStringName: string;
    delayReplicationFor: string;
}

export interface OngoingTaskSqlEtlDetails extends OngoingTask {
    taskType: "SqlEtl",
    configuration: SqlEtlConfiguration;
}

export type OngoingTaskState =
    "None"
    | "Enabled"
    | "Disabled"
    | "PartiallyEnabled";

export interface OngoingTaskSubscription extends OngoingTask {
    taskType: "Subscription",
    query: string;
    subscriptionName: string;
    subscriptionId: number;
    changeVectorForNextBatchStartingPoint: string;
    changeVectorForNextBatchStartingPointPerShard: Record<string, string>;
    archivedDataProcessingBehavior: ArchivedDataProcessingBehavior;
    lastBatchAckTime: Date;
    disabled: boolean;
    lastClientConnectionTime: Date;
}

export interface OngoingTaskElasticSearchEtlDetails extends OngoingTask {
    taskType: "ElasticSearchEtl",
    configuration: ElasticSearchEtlConfiguration;
}

export interface OngoingTaskOlapEtlDetails extends OngoingTask {
    taskType: "OlapEtl",
    configuration: OlapEtlConfiguration;
}

export interface OngoingTaskQueueEtlDetails extends OngoingTask {
    configuration: QueueEtlConfiguration;
}
