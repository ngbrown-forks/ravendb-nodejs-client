import { ExternalReplicationBase } from "../../Replication/ExternalReplicationBase.js";
import { PullReplicationMode } from "./PullReplicationMode.js";

export interface PullReplicationAsSink extends ExternalReplicationBase {
    mode: PullReplicationMode;
    allowedHubToSinkPaths?: string[];
    allowedSinkToHubPaths?: string[];
    certificateWithPrivateKey?: string;
    certificatePassword?: string;
    accessName?: string;
    hubName?: string;

    /**
     * @deprecated Use HubName instead
     */
    hubDefinitionName?: string;
}
