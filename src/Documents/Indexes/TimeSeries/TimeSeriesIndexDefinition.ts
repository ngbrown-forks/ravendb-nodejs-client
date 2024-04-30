import { IndexDefinition } from "../IndexDefinition.js";
import { IndexSourceType } from "../IndexSourceType.js";

export class TimeSeriesIndexDefinition extends IndexDefinition {
    get sourceType(): IndexSourceType {
        return "TimeSeries";
    }
}