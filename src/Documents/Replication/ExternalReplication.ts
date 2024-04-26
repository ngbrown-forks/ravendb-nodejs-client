import { ExternalReplicationBase } from "./ExternalReplicationBase.js";
import { IExternalReplication } from "../Operations/Replication/IExternalReplication.js";

export interface ExternalReplication extends ExternalReplicationBase, IExternalReplication {
    delayReplicationFor?: string;
}
