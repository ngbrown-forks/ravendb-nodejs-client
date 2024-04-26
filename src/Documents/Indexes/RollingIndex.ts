import { RollingIndexDeployment } from "./RollingIndexDeployment.js";

export interface RollingIndex {
    activeDeployments: Record<string, RollingIndexDeployment>;
    raftCommandIndex: number;
}
