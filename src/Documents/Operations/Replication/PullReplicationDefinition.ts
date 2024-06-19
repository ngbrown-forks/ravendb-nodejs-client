import { PreventDeletionsMode } from "./PreventDeletionsMode.js";
import { PullReplicationMode } from "./PullReplicationMode.js";

export interface PullReplicationDefinition {
    delayReplicationFor?: string;
    disabled?: boolean;
    mentorNode?: string;

    mode?: PullReplicationMode;
    name: string;
    taskId?: number;
    withFiltering?: boolean;
    preventDeletionsMode?: PreventDeletionsMode;
}