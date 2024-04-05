import { EventEmitter } from "node:events";
import { parser } from "stream-json/Parser";
import {
    ObjectKeyCaseTransformStreamOptions,
    ObjectKeyCaseTransformStream
} from "../Mapping/Json/Streams/ObjectKeyCaseTransformStream";
import {
    ObjectKeyCaseTransformProfile,
    getObjectKeyCaseTransformProfile
} from "../Mapping/Json/Conventions";
import { CasingConvention } from "../Utility/ObjectUtil";
import { pipelineAsync } from "../Utility/StreamUtil";
import { Stream, Transform, Readable, Writable, pipeline } from "node:stream";
import {
    CollectResultStream,
    CollectResultStreamOptions,
    lastChunk
} from "../Mapping/Json/Streams/CollectResultStream";
import { throwError, getError } from "../Exceptions";
import { TypeUtil } from "../Utility/TypeUtil";
import { connectTo } from "stream-json/Assembler";
import { ErrorFirstCallback } from "../Types/Callbacks";
import { StringBuilder } from "../Utility/StringBuilder";
import { parser as jsonlParser } from "stream-json/jsonl/Parser";

export interface RavenCommandResponsePipelineOptions<TResult> {
    collectBody?: boolean | ((body: string) => void);
    jsonAsync?: {
        filters: any[];
    };
    jsonlAsync?: {
        transforms: Transform[];
    };
    jsonSync?: boolean;
    streamKeyCaseTransform?: ObjectKeyCaseTransformStreamOptions;
    collectResult: CollectResultStreamOptions<TResult>;
    transform?: Stream;
}

export class RavenCommandResponsePipeline<TStreamResult> extends EventEmitter {

    private readonly _opts: RavenCommandResponsePipelineOptions<TStreamResult>;
    private _body: StringBuilder = new StringBuilder();

    private constructor() {
        super();
        this._opts = {} as RavenCommandResponsePipelineOptions<TStreamResult>;
    }

    public static create<TResult>(): RavenCommandResponsePipeline<TResult> {
        return new RavenCommandResponsePipeline();
    }

    public parseJsonAsync(filters?: any[]) {
        this._opts.jsonAsync = { filters };
        return this;
    }

    public parseJsonSync() {
        this._opts.jsonSync = true;
        return this;
    }

    /**
     * @param type Type of object to extract from objects stream - use Raw to skip extraction.
     * @param options
     */
    public parseJsonlAsync(valueExtractor: (obj: any) => any, options: { transforms?: Transform[] } = {}) {
        const transforms = options?.transforms ?? [];
        const extractItemTransform = new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                const value = valueExtractor(chunk["value"]);
                if (!value) {
                    return callback();
                }

                callback(null, {...chunk, value});
            }
        });

        transforms.unshift(extractItemTransform);

        this._opts.jsonlAsync = {
            transforms
        };

        return this;
    }

    public collectBody(callback?: (body: string) => void) {
        this._opts.collectBody = callback || true;
        return this;
    }

    public objectKeysTransform(defaultTransform: CasingConvention, profile?: ObjectKeyCaseTransformProfile): this;
    public objectKeysTransform(opts: ObjectKeyCaseTransformStreamOptions): this;
    public objectKeysTransform(
        optsOrTransform: CasingConvention | ObjectKeyCaseTransformStreamOptions,
        profile?: ObjectKeyCaseTransformProfile): this {

        if (!this._opts.jsonAsync && !this._opts.jsonSync) {
            throwError("InvalidOperationException",
                "Cannot use key case transform without doing parseJson() or parseJsonAsync() first.");
        }

        this._opts.streamKeyCaseTransform = !optsOrTransform || typeof optsOrTransform === "string"
            ? getObjectKeyCaseTransformProfile(optsOrTransform as CasingConvention, profile)
            : optsOrTransform;

        if (this._opts.jsonAsync) {
            this._opts.streamKeyCaseTransform.handleKeyValue = true;
        }

        return this;
    }

    public collectResult(
        reduce: (result: TStreamResult, next: object) => TStreamResult,
        init: TStreamResult): RavenCommandResponsePipeline<TStreamResult>;
    public collectResult(opts: CollectResultStreamOptions<TStreamResult>): RavenCommandResponsePipeline<TStreamResult>;
    public collectResult(
        optsOrReduce:
            CollectResultStreamOptions<TStreamResult> | ((result: TStreamResult, next: object) => TStreamResult),
        init?: TStreamResult): RavenCommandResponsePipeline<TStreamResult> {
        if (typeof optsOrReduce === "function") {
            this._opts.collectResult = { reduceResults: optsOrReduce, initResult: init };
        } else {
            this._opts.collectResult = optsOrReduce;
        }

        return this;
    }

    public stream(src: Stream): Readable;
    public stream(src: Stream, dst: Writable, callback: ErrorFirstCallback<void>): Stream;
    public stream(src: Stream, dst?: Writable, callback?: ErrorFirstCallback<void>): Stream {
        const streams = this._buildUp(src);
        if (dst) {
            streams.push(dst);
        }

        return (pipeline as any)(...streams, TypeUtil.NOOP) as Stream; //TODO: remove noop?
    }

    private _appendBody(s: Buffer | string): void {
        this._body.append(s.toString());
    }

    private _buildUp(src: Stream) {
        if (!src) {
            throwError("MappingError", "Body stream cannot be null.");
        }

        const opts = this._opts;
        const streams: Stream[] = [src];
        if (opts.collectBody) {
            src.on("data", (chunk: Buffer | string) => this._appendBody(chunk));
        }

        if (opts.jsonAsync) {
            streams.push(parser({ streamValues: false }));

            if (opts.jsonAsync.filters && opts.jsonAsync.filters.length) {
                streams.push(...opts.jsonAsync.filters);
            }
        } else if (opts.jsonlAsync) {
            streams.push(jsonlParser());

            if (opts.jsonlAsync.transforms) {
                streams.push(...opts.jsonlAsync.transforms);
            }
        } else if (opts.jsonSync) {
            const bytesChunks = [];
            const parseJsonSyncTransform = new Transform({
                readableObjectMode: true,
                transform(chunk, enc, callback) {
                    bytesChunks.push(chunk);
                    callback();
                },
                flush(callback) {
                    let str = null;
                    try {
                        str = Buffer.concat(bytesChunks).toString("utf8");
                    } catch(err){
                        callback(
                            getError("InvalidDataException", `Failed to concat / decode server response`, err));
                        return;
                    }
                    try {
                        callback(null, JSON.parse(str));
                    } catch (err) {
                        callback(
                            getError("InvalidOperationException", `Error parsing response: '${str}'.`, err));
                    }
                }
            });
            streams.push(parseJsonSyncTransform);
        }

        if (opts.streamKeyCaseTransform) {
            const handlePath = !!opts.jsonAsync;
            const keyCaseOpts = Object.assign({}, opts.streamKeyCaseTransform, { handlePath });
            streams.push(new ObjectKeyCaseTransformStream(keyCaseOpts));
        }

        return streams;
    }

    public process(src: Stream): Promise<TStreamResult> {
        const streams = this._buildUp(src);
        const opts = this._opts;
        let resultPromise: Promise<TStreamResult>;
        if (opts.jsonAsync) {
            const asm = connectTo(streams.at(-1) as any);
            resultPromise = new Promise(resolve => {
                asm.on("done", asm => resolve(asm.current));
            });
        } else {
            const collectResultOpts = !opts.collectResult || !opts.collectResult.reduceResults
                ? { reduceResults: lastChunk as any } : opts.collectResult;
            const collectResult = new CollectResultStream(collectResultOpts);
            streams.push(collectResult);
            resultPromise = collectResult.promise;
        }

        if (opts.collectBody) {
            resultPromise
                .then(() => {
                    const body = this._body.toString();
                    this.emit("body", body);
                    if (typeof opts.collectBody === "function") {
                        opts.collectBody(body);
                    }
                });
        }

        return pipelineAsync(...streams)
            .then(() => resultPromise);
    }
}
