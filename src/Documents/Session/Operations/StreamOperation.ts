import { Readable } from "node:stream";
import { InMemoryDocumentSessionOperations } from "../InMemoryDocumentSessionOperations";
import { QueryStreamCommand } from "../../Commands/QueryStreamCommand";
import { IndexQuery } from "../../Queries/IndexQuery";
import { throwError } from "../../../Exceptions";
import { StartingWithOptions } from "../IDocumentSession";
import { StreamCommand } from "../../Commands/StreamCommand";
import { TypeUtil } from "../../../Utility/TypeUtil";
import { StreamResultResponse } from "../../Commands/StreamResultResponse";
import { getDocumentResultsAsObjects } from "../../../Mapping/Json/Streams/Pipelines";
import { StringBuilder } from "../../../Utility/StringBuilder";
import { ObjectUtil } from "../../../Utility/ObjectUtil";
import { RavenCommandResponsePipeline } from "../../../Http/RavenCommandResponsePipeline";
import Ignore from "stream-json/filters/Ignore.js";
import StreamValues from "stream-json/streamers/StreamValues.js";

export class StreamOperation {
    private readonly _session: InMemoryDocumentSessionOperations;
    private _isQueryStream: boolean;

    constructor(session: InMemoryDocumentSessionOperations) {
        this._session = session;
    }

    public createRequest(query: IndexQuery): QueryStreamCommand;
    public createRequest(idPrefix: string, opts: StartingWithOptions): StreamCommand;
    public createRequest(
        idPrefixOrQuery: string | IndexQuery, opts?: StartingWithOptions): QueryStreamCommand | StreamCommand {
        if (TypeUtil.isString(idPrefixOrQuery)) {
            return this._createRequestForIdPrefix(idPrefixOrQuery, opts);
        }

        return this._createRequestForQuery(idPrefixOrQuery);
    }

    private _createRequestForQuery(query: IndexQuery): QueryStreamCommand {
        if (!query) {
            throwError("InvalidArgumentException", "Query cannot be null.");
        }

        this._isQueryStream = true;
        if (query.waitForNonStaleResults) {
            throwError("NotSupportedException",
                "Since stream() does not wait for indexing (by design), "
                + " streaming query with waitForNonStaleResults is not supported");
        }
        this._session.incrementRequestCount();
        return new QueryStreamCommand(this._session.conventions, query);
    }

    private _createRequestForIdPrefix(idPrefix: string, opts: StartingWithOptions): StreamCommand {
        const format = this._session.conventions.useJsonlStreaming ? 'jsonl' : 'json';

        const sb = new StringBuilder(`streams/docs?format=${format}&`);
        if (idPrefix) {
            sb.append("startsWith=")
                .append(encodeURIComponent(idPrefix)).append("&");
        }

        if (opts) {
            if ("matches" in opts) {
                sb.append("matches=")
                    .append(encodeURIComponent(opts.matches)).append("&");
            }

            if ("exclude" in opts) {
                sb.append("exclude=")
                    .append(encodeURIComponent(opts.exclude)).append("&");
            }

            if ("startAfter" in opts) {
                sb.append("startAfter=")
                    .append(encodeURIComponent(opts.startAfter)).append("&");
            }

            if ("start" in opts) {
                sb.append("start=").append(opts.start).append("&");
            }

            if ("pageSize" in opts && opts.pageSize !== Number.MAX_VALUE) {
                sb.append("pageSize=").append(opts.pageSize).append("&");
            }
        }

        return new StreamCommand(sb.toString());
    }

    public setResult(response: StreamResultResponse): Readable {
        if (!response) {
            throwError("IndexDoesNotExistException", "The index does not exists, failed to stream results.");
        }

        const result = getDocumentResultsAsObjects(this._session.conventions, !!this._isQueryStream)
            .stream(response.stream);

        if (this._isQueryStream) {
            const pipeline = RavenCommandResponsePipeline.create<object[]>();

            this._session.conventions.useJsonlStreaming
                ? pipeline.parseJsonlAsync(x => x["Stats"])
                : pipeline.parseJsonAsync([
                    new Ignore({ filter: /^Results|Includes$/ }),
                    new StreamValues()
                ]);

                pipeline.stream(response.stream)
                .on("error", err => result.emit("error", err))
                .on("data", data => {
                    const rawWithCamel = ObjectUtil.transformObjectKeys(data["value"], {
                        defaultTransform: "camel"
                    });

                    const statsResult =
                        this._session.conventions.objectMapper
                            .fromObjectLiteral(rawWithCamel, {
                                nestedTypes: {
                                    indexTimestamp: "date"
                                }
                            });

                    result.emit("stats", statsResult);
                });
        }

        result.on("newListener", (event, listener) => {
            if (event === "data") {
                response.stream.resume();
            }
        });

        return result;
    }

}
