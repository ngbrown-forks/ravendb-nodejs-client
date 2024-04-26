import { Transform } from "node:stream";
import {
    ObjectUtil,
    ObjectChangeCaseOptions,
    ObjectChangeCaseOptionsBase, FieldNameConversion
} from "../../../Utility/ObjectUtil.js";
import { TypeUtil } from "../../../Utility/TypeUtil.js";

export interface ObjectKeyCaseTransformStreamOptions
    extends ObjectChangeCaseOptions {
}

const DEFAULT_OBJECT_KEY_CASE_TRANSFORM_OPTS = {
    arrayRecursive: true,
    recursive: true
};


export class ObjectKeyCaseTransformStream extends Transform {

    constructor(private _opts: ObjectKeyCaseTransformStreamOptions) {
        super({ objectMode: true });

        this._opts = Object.assign({}, DEFAULT_OBJECT_KEY_CASE_TRANSFORM_OPTS, this._opts);
    }

    public _transform(chunk: any, enc: string, callback) {
        let entry = chunk;
        const key = chunk["key"];
        if (TypeUtil.isPrimitive(entry) || TypeUtil.isNullOrUndefined(entry)) {
            return callback(null, chunk);
        }

        const opts = Object.assign({}, this._opts);
        opts.ignorePaths = [...new Set(opts.ignorePaths || [])];

        entry = ObjectUtil.transformObjectKeys(entry, opts);
        callback(null, entry);
    }
}
