import { DocumentConventions } from "./DocumentConventions.js";
import { ShardedBatchBehavior } from "../Session/ShardedBatchBehavior.js";

export class ShardingConventions {
    private readonly _conventions: DocumentConventions;

    private _batchBehavior: ShardedBatchBehavior;


    get batchBehavior(): ShardedBatchBehavior {
        return this._batchBehavior;
    }

    set batchBehavior(value: ShardedBatchBehavior) {
        this._conventions._assertNotFrozen();
        this._batchBehavior = value;
    }

    public constructor(conventions: DocumentConventions) {
        this._conventions = conventions;
        this._batchBehavior = "Default";
    }
}