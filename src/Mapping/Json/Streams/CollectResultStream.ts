import { Writable } from "node:stream";


export function lastChunk<T>(_: object, chunk: T): T {
    return chunk;
}

export class CollectResultStream<TResult = object> extends Writable {

    private _resultIndex = 0;
    private _result: TResult;
    private readonly _reduceResults: (
        result: TResult,
        next: object,
        index?: number) => TResult;

    private _resultPromise: Promise<unknown>;

    private _resolver: { resolve: (result: any) => void, reject: (error?: any) => void };

    get promise(): Promise<TResult> {
        return this._resultPromise as Promise<TResult>;
    }

    constructor(reduceResult: (
        result: TResult,
        next: object,
        index?: number) => TResult) {
        super({ objectMode: true });

        this._resultPromise = new Promise((resolve, reject) => {
            this._resolver = { resolve, reject };
        });

        super.once("finish", () => {
            this._resolver.resolve(this._result);
        });

        this._reduceResults = reduceResult;
    }
    
    public _write(chunk, enc, callback) {
        this._result = this._reduceResults(this._result, chunk, this._resultIndex);
        this._resultIndex++;
        callback();
    }
}
