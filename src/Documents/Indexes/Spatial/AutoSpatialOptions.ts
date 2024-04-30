import { AutoSpatialMethodType } from "../Enums.js";
import { SpatialOptions } from "../Spatial.js";

export interface AutoSpatialOptions extends SpatialOptions {
    methodType: AutoSpatialMethodType;
    methodArguments: string[];
}