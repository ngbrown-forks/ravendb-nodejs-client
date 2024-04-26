import { PullReplicationDefinition } from "./PullReplicationDefinition.js";
import { OngoingTaskPullReplicationAsHub } from "../OngoingTasks/OngoingTaskPullReplicationAsHub.js";

export interface PullReplicationDefinitionAndCurrentConnections {
    definition: PullReplicationDefinition;
    ongoingTasks: OngoingTaskPullReplicationAsHub[];
}
