import { IExternalReplication } from "../../../Documents/Operations/Replication/IExternalReplication.js";
import { IServerWideTask } from "./IServerWideTask.js";

export interface ServerWideExternalReplication extends IExternalReplication, IServerWideTask {
    topologyDiscoveryUrls: string[];
}
