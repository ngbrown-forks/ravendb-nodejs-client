import { IndexDefinition } from "../IndexDefinition.js";
import { IndexSourceType } from "../IndexSourceType.js";

export class CountersIndexDefinition extends IndexDefinition {

    public get sourceType(): IndexSourceType {
        return "Counters";
    }
}