import { EventEmitter } from "node:events";
import {
    ObjectKeyCaseTransformStreamOptions,
    ObjectKeyCaseTransformStream
} from "../Mapping/Json/Streams/ObjectKeyCaseTransformStream";
import { pipelineAsync } from "../Utility/StreamUtil";
import { Stream, Transform, Readable, Writable, pipeline } from "node:stream";
import {
    CollectResultStream,
} from "../Mapping/Json/Streams/CollectResultStream";
import { throwError, getError } from "../Exceptions";
import { TypeUtil } from "../Utility/TypeUtil";
import { ErrorFirstCallback } from "../Types/Callbacks";
import { StringBuilder } from "../Utility/StringBuilder";
import JsonlParser from "stream-json/jsonl/Parser.js";
import { FieldNameConversion } from "../Utility/ObjectUtil";

export interface RavenCommandResponsePipelineOptions<TResult> {
    collectBody?: boolean | ((body: string) => void);
    jsonlAsync?: {
        transforms: Transform[];
    };
    jsonSync?: boolean;
    streamKeyCaseTransform?: ObjectKeyCaseTransformStreamOptions;
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

    public objectKeysTransform(defaultTransform: FieldNameConversion): this;
    public objectKeysTransform(opts: ObjectKeyCaseTransformStreamOptions): this;
    public objectKeysTransform(
        optsOrTransform: FieldNameConversion | ObjectKeyCaseTransformStreamOptions): this {
        this._opts.streamKeyCaseTransform = !optsOrTransform || typeof optsOrTransform === "function" //TODO:
            ? { defaultTransform: optsOrTransform as FieldNameConversion }
            : optsOrTransform;

        return this;
    }

    public stream(src: Stream): Readable;
    public stream(src: Stream, dst: Writable, callback: ErrorFirstCallback<void>): Stream;
    public stream(src: Stream, dst?: Writable, callback?: ErrorFirstCallback<void>): Stream {
        const streams = this._buildUp(src);
        if (dst) {
            streams.push(dst);
        }

        return (pipeline as any)(...streams, TypeUtil.NOOP);
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

        if (opts.jsonlAsync) {
            streams.push(new JsonlParser());

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
            const keyCaseOpts = Object.assign({}, opts.streamKeyCaseTransform, { handlePath: false });
            streams.push(new ObjectKeyCaseTransformStream(keyCaseOpts));
        }

        return streams;
    }

    public async process(src: Stream): Promise<TStreamResult> {
        const streams = this._buildUp(src);
        const opts = this._opts;

        const collectResult = new CollectResultStream<TStreamResult>();
        streams.push(collectResult);
        const resultPromise = collectResult.promise;

        await pipelineAsync(...streams);

        const result = await resultPromise;

        if (opts.collectBody) {
            const body = this._body.toString();
            this.emit("body", body);
            if (typeof opts.collectBody === "function") {
                opts.collectBody(body);
            }
        }

        return result;
    }
}
