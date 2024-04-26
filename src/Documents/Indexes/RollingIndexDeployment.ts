import { RollingIndexState } from "./RollingIndexState.js";

export interface RollingIndexDeployment {
    state: RollingIndexState;
    createdAt: Date;
    startedAt: Date;
    finishedAt: Date;
}