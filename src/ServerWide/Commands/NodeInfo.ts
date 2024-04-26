import { BuildNumber } from "../Operations/BuildNumber.js";
import { ServerNodeRole } from "../../Http/ServerNode.js";

export interface NodeInfo {
    nodeTag: string;
    topologyId: string;
    certificate: string;
    clusterStatus: string;
    numberOfCores: number;
    installedMemoryInGb: number;
    usableMemoryInGb: number;
    buildInfo: BuildNumber;
    serverRole: ServerNodeRole;
    hasFixedPort: boolean;
    serverSchemaVersion: number;
}
