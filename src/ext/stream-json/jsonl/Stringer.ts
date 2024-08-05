
import { Transform } from "node:stream";

export class JsonlStringer extends Transform {
    _replacer: any;

    static make(options) {
        return new JsonlStringer(options);
    }

    constructor(options) {
        super(Object.assign({}, options, {writableObjectMode: true, readableObjectMode: false}));
        this._replacer = options && options.replacer;
    }

    _transform(chunk, _, callback) {
        this.push(JSON.stringify(chunk, this._replacer));
        this._transform = this._nextTransform;
        callback(null);
    }

    _nextTransform(chunk, _, callback) {
        this.push('\n' + JSON.stringify(chunk, this._replacer));
        callback(null);
    }
}
