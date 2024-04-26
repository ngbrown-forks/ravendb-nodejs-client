import { OngoingTask } from "./OngoingTask.js";

export interface OngoingTaskPullReplicationAsHub extends OngoingTask {
    taskType: "PullReplicationAsHub";

    destinationUrl: string;
    destinationDatabase: string;
    delayReplicationFor: string;
}
