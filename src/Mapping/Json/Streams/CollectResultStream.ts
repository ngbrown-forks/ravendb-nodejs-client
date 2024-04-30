import { Writable } from "node:stream";

export class CollectResultStream<TResult = object> extends Writable {

    private _result: TResult;
    private readonly _resultPromise: Promise<TResult>;

    get promise(): Promise<TResult> {
        return this._resultPromise as Promise<TResult>;
    }

    constructor() {
        super({ objectMode: true });

        this._resultPromise = new Promise<TResult>((resolve, reject) => {
            this.once("finish", () => resolve(this._result));
        });
    }
    
    public _write(chunk, enc, callback) {
        this._result = chunk;
        callback();
    }
}
