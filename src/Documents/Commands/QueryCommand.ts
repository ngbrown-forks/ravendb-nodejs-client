import { HttpRequestParameters } from "../../Primitives/Http.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { QueryResult } from "../Queries/QueryResult.js";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";
import { IndexQuery, writeIndexQuery } from "../Queries/IndexQuery.js";
import { throwError } from "../../Exceptions/index.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { JsonSerializer } from "../../Mapping/Json/Serializer.js";
import { Stream } from "node:stream";
import { RavenCommandResponsePipeline } from "../../Http/RavenCommandResponsePipeline.js";
import { StringBuilder } from "../../Utility/StringBuilder.js";
import { ServerCasing, ServerResponse } from "../../Types/index.js";
import { QueryTimings } from "../Queries/Timings/QueryTimings.js";
import { StringUtil } from "../../Utility/StringUtil.js";
import { readToEnd, stringToReadable } from "../../Utility/StreamUtil.js";
import { ObjectUtil } from "../../Utility/ObjectUtil.js";
import { InMemoryDocumentSessionOperations } from "../Session/InMemoryDocumentSessionOperations.js";

export interface QueryCommandOptions {
    metadataOnly?: boolean;
    indexEntriesOnly?: boolean;
}

export class QueryCommand extends RavenCommand<QueryResult> {

    protected _session: InMemoryDocumentSessionOperations;
    private readonly _indexQuery: IndexQuery;
    private readonly _metadataOnly: boolean;
    private readonly _indexEntriesOnly: boolean;

    public constructor(
        session: InMemoryDocumentSessionOperations, indexQuery: IndexQuery, opts: QueryCommandOptions) {
        super();

        this._session = session;

        if (!indexQuery) {
            throwError("InvalidArgumentException", "indexQuery cannot be null.");
        }

        this._indexQuery = indexQuery;

        opts = opts || {};
        this._metadataOnly = opts.metadataOnly;
        this._indexEntriesOnly = opts.indexEntriesOnly;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        this._canCache = !this._indexQuery.disableCaching;

        // we won't allow aggressive caching of queries with WaitForNonStaleResults
        this._canCacheAggressively = this._canCache && !this._indexQuery.waitForNonStaleResults;

        const path = new StringBuilder(node.url)
            .append("/databases/")
            .append(node.database)
            .append("/queries?queryHash=")
            // we need to add a query hash because we are using POST queries
            // so we need to unique parameter per query so the query cache will
            // work properly
            .append(this._indexQuery.getQueryHash(this._session.conventions.objectMapper));

        if (this._metadataOnly) {
            path.append("&metadataOnly=true");
        }

        if (this._indexEntriesOnly) {
            path.append("&debug=entries");
        }

        path.append("&addTimeSeriesNames=true");

        const uri = path.toString();
        const body = writeIndexQuery(this._session.conventions, this._indexQuery);
        const headers = this._headers().typeAppJson().build();
        return {
            method: "POST",
            uri,
            headers,
            body
        };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this.result = null;
            return;
        }

        let body: string = null;
        this.result = await QueryCommand.parseQueryResultResponseAsync(
            bodyStream, this._session.conventions, fromCache, b => body = b);

        return body;
    }

    public get isReadRequest(): boolean {
        return true;
    }

    public static async parseQueryResultResponseAsync(
        bodyStream: Stream,
        conventions: DocumentConventions,
        fromCache: boolean,
        bodyCallback?: (body: string) => void): Promise<QueryResult> {

        const body = await readToEnd(bodyStream);
        bodyCallback?.(body);

        const parsedJson = JSON.parse(body);

        const queryResult = QueryCommand._mapToLocalObject(parsedJson, conventions);

        if (fromCache) {
            queryResult.durationInMs = -1;

            if (queryResult.timingsInMs) {
                queryResult.timingsInMs.durationInMs = -1;
                queryResult.timingsInMs = null;
            }
        }

        return queryResult;
    }

    private static _mapTimingsToLocalObject(timings: ServerCasing<ServerResponse<QueryTimings>>) {
        if (!timings) {
            return undefined;
        }

        const mapped = new QueryTimings();
        mapped.durationInMs = timings.DurationInMs;
        mapped.timings = timings.Timings ? {} : undefined;
        if (timings.Timings) {
            for (const time of Object.keys(timings.Timings)) {
                mapped.timings[StringUtil.uncapitalize(time)] = QueryCommand._mapTimingsToLocalObject(timings.Timings[time]);
            }
        }
        return mapped;
    }


    private static _mapToLocalObject(json: any, conventions: DocumentConventions): QueryResult {
        const props: Omit<QueryResult, "scoreExplanations" | "cappedMaxResults" | "createSnapshot" | "resultSize"> = {
            results: json.Results.map(x => ObjectUtil.transformDocumentKeys(x, conventions)),
            includes: ObjectUtil.mapIncludesToLocalObject(json.Includes, conventions),
            indexName: json.IndexName,
            indexTimestamp: conventions.dateUtil.parse(json.IndexTimestamp),
            includedPaths: json.IncludedPaths,
            isStale: json.IsStale,
            skippedResults: json.SkippedResults,
            totalResults: json.TotalResults,
            longTotalResults: json.LongTotalResults,
            highlightings: json.Highlightings,
            explanations: json.Explanations,
            timingsInMs: json.TimingsInMs,
            lastQueryTime: conventions.dateUtil.parse(json.LastQueryTime),
            durationInMs: json.DurationInMs,
            resultEtag: json.ResultEtag,
            nodeTag: json.NodeTag,
            scannedResults: json.ScannedResults,
            counterIncludes: ObjectUtil.mapCounterIncludesToLocalObject(json.CounterIncludes),
            includedCounterNames: json.IncludedCounterNames,
            timeSeriesIncludes: ObjectUtil.mapTimeSeriesIncludesToLocalObject(json.TimeSeriesIncludes),
            compareExchangeValueIncludes: ObjectUtil.mapCompareExchangeToLocalObject(json.CompareExchangeValueIncludes),
            revisionIncludes: json.RevisionIncludes,
            timeSeriesFields: json.TimeSeriesFields,
            timings: QueryCommand._mapTimingsToLocalObject(json.Timings)
        }

        return Object.assign(new QueryResult(), props);
    }
}
