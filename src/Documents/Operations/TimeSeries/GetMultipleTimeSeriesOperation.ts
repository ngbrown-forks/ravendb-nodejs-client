import { IOperation, OperationResultType } from "../OperationAbstractions.js";
import { TimeSeriesDetails } from "./TimeSeriesDetails.js";
import { TimeSeriesRange } from "./TimeSeriesRange.js";
import { TypeUtil } from "../../../Utility/TypeUtil.js";
import { throwError } from "../../../Exceptions/index.js";
import { StringUtil } from "../../../Utility/StringUtil.js";
import { IDocumentStore } from "../../IDocumentStore.js";
import { HttpCache } from "../../../Http/HttpCache.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { DateUtil } from "../../../Utility/DateUtil.js";
import { Stream } from "node:stream";
import { CaseInsensitiveKeysMap } from "../../../Primitives/CaseInsensitiveKeysMap.js";
import { GetTimeSeriesCommand, reviveTimeSeriesRangeResult } from "./GetTimeSeriesOperation.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { StringBuilder } from "../../../Utility/StringBuilder.js";
import { ITimeSeriesIncludeBuilder } from "../../Session/Loaders/ITimeSeriesIncludeBuilder.js";

export class GetMultipleTimeSeriesOperation implements IOperation<TimeSeriesDetails> {
    private readonly _docId: string;
    private _ranges: TimeSeriesRange[];
    private readonly _start: number;
    private readonly _pageSize: number;
    private readonly _includes: (includeBuilder: ITimeSeriesIncludeBuilder) => void;
    private readonly _returnFullResults: boolean;

    public constructor(docId: string, ranges: TimeSeriesRange[])
    public constructor(docId: string, ranges: TimeSeriesRange[], start: number, pageSize: number)
    public constructor(docId: string, ranges: TimeSeriesRange[], start: number, pageSize: number, includes: (includeBuilder: ITimeSeriesIncludeBuilder) => void)
    public constructor(docId: string, ranges: TimeSeriesRange[], start?: number, pageSize?: number, includes?: (includeBuilder: ITimeSeriesIncludeBuilder) => void, returnFullResults?: boolean)
    public constructor(docId: string, ranges: TimeSeriesRange[], start?: number, pageSize?: number, includes?: (includeBuilder: ITimeSeriesIncludeBuilder) => void, returnFullResults?: boolean) {
        if (!ranges) {
            throwError("InvalidArgumentException", "Ranges cannot be null");
        }
        if (StringUtil.isNullOrEmpty(docId)) {
            throwError("InvalidArgumentException", "DocId cannot be null or empty")
        }
        this._docId = docId;
        this._start = start ?? 0;
        this._pageSize = pageSize ?? TypeUtil.MAX_INT32;
        this._ranges = ranges;
        this._includes = includes;
        this._returnFullResults = returnFullResults;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(store: IDocumentStore, conventions: DocumentConventions, httpCache: HttpCache): RavenCommand<TimeSeriesDetails> {
        return new GetMultipleTimeSeriesCommand(conventions, this._docId, this._ranges, this._start, this._pageSize, this._includes, this._returnFullResults);
    }
}

export class GetMultipleTimeSeriesCommand extends RavenCommand<TimeSeriesDetails> {
    private readonly _conventions: DocumentConventions;
    private readonly _docId: string;
    private readonly _ranges: TimeSeriesRange[];
    private readonly _start: number;
    private readonly _pageSize: number;
    private readonly _includes: (includeBuilder: ITimeSeriesIncludeBuilder) => void;
    private readonly _returnFullResults: boolean;

    constructor(
        conventions: DocumentConventions,
        docId: string,
        ranges: TimeSeriesRange[],
        start: number,
        pageSize: number,
        includes?: (includeBuilder: ITimeSeriesIncludeBuilder) => void,
        returnFullResults?: boolean) {
        super();

        if (!docId) {
            throwError("InvalidArgumentException", "DocId cannot be null");
        }

        this._conventions = conventions;
        this._docId = docId;
        this._ranges = ranges;
        this._start = start;
        this._pageSize = pageSize;
        this._includes = includes;
        this._returnFullResults = returnFullResults;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const pathBuilder = new StringBuilder(node.url);

        pathBuilder
            .append("/databases/")
            .append(node.database)
            .append("/timeseries/ranges")
            .append("?docId=")
            .append(this._urlEncode(this._docId));

        if (this._start > 0) {
            pathBuilder
                .append("&start=")
                .append(this._start.toString());
        }

        if (this._pageSize < TypeUtil.MAX_INT32) {
            pathBuilder
                .append("&pageSize=")
                .append(this._pageSize.toString());
        }

        if (this._returnFullResults) {
            pathBuilder
                .append("&full=true");
        }

        if (!this._ranges.length) {
            throwError("InvalidArgumentException", "Ranges cannot be null or empty");
        }

        for (const range of this._ranges) {
            if (StringUtil.isNullOrEmpty(range.name)) {
                throwError("InvalidArgumentException", "Missing name argument in TimeSeriesRange. Name cannot be null or empty");
            }

            pathBuilder
                .append("&name=")
                .append(range.name || "")
                .append("&from=")
                .append(range.from ? DateUtil.utc.stringify(range.from) : "")
                .append("&to=")
                .append(range.to ? DateUtil.utc.stringify(range.to) : "")
        }

        if (this._includes) {
            GetTimeSeriesCommand.addIncludesToRequest(pathBuilder, this._includes);
        }

        const uri = pathBuilder.toString();

        return {
            uri,
            method: "GET"
        }
    }

    async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            return;
        }

        let body: string = null;
        const results = await this._pipeline<any>()
            .parseJsonSync()
            .collectBody(b => body = b)
            .process(bodyStream);

        this.result = new TimeSeriesDetails();
        this.result.id = results.Id;
        this.result.values = CaseInsensitiveKeysMap.create();

        for (const [key, value] of Object.entries(results.Values)) {
            const mapped = (value as any).map(x => reviveTimeSeriesRangeResult(GetTimeSeriesCommand.mapToLocalObject(x)));
            this.result.values.set(key, mapped);
        }

        return body;
    }

    get isReadRequest(): boolean {
        return true;
    }
}
