import { Readable } from "node:stream";
import { InMemoryDocumentSessionOperations } from "../InMemoryDocumentSessionOperations.js";
import { QueryStreamCommand } from "../../Commands/QueryStreamCommand.js";
import { IndexQuery } from "../../Queries/IndexQuery.js";
import { throwError } from "../../../Exceptions/index.js";
import { StartingWithOptions } from "../IDocumentSession.js";
import { StreamCommand } from "../../Commands/StreamCommand.js";
import { TypeUtil } from "../../../Utility/TypeUtil.js";
import { StreamResultResponse } from "../../Commands/StreamResultResponse.js";
import { getDocumentResultsAsObjects } from "../../../Mapping/Json/Streams/Pipelines.js";
import { StringBuilder } from "../../../Utility/StringBuilder.js";
import { ObjectUtil } from "../../../Utility/ObjectUtil.js";
import { RavenCommandResponsePipeline } from "../../../Http/RavenCommandResponsePipeline.js";
import JsonlParser from "stream-json/jsonl/Parser.js";

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
        const sb = new StringBuilder(`streams/docs?format=jsonl&`);
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

    public setResult(parserProvider: new () => JsonlParser, response: StreamResultResponse): Readable {
        if (!response) {
            throwError("IndexDoesNotExistException", "The index does not exists, failed to stream results.");
        }

        const result = getDocumentResultsAsObjects(parserProvider, this._session.conventions, !!this._isQueryStream)
            .stream(response.stream);

        if (this._isQueryStream) {
            const pipeline = RavenCommandResponsePipeline.create<object[]>();

            pipeline.parseJsonlAsync(parserProvider, x => x["Stats"])

            pipeline.stream(response.stream)
                .on("error", err => result.emit("error", err))
                .on("data", data => {
                    const rawWithCamel = ObjectUtil.transformObjectKeys(data["value"], {
                        defaultTransform: ObjectUtil.camel
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
