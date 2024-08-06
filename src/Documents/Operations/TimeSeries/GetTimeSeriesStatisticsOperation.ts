import { IOperation, OperationResultType } from "../OperationAbstractions.js";
import { TimeSeriesStatistics } from "./TimeSeriesStatistics.js";
import { IDocumentStore } from "../../IDocumentStore.js";
import { HttpCache } from "../../../Http/HttpCache.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { Stream } from "node:stream";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { ServerResponse } from "../../../Types/index.js";
import { DateUtil } from "../../../Utility/DateUtil.js";

export class GetTimeSeriesStatisticsOperation implements IOperation<TimeSeriesStatistics> {
    private readonly _documentId: string;

    /**
     * Retrieve start, end and total number of entries for all time-series of a given document
     * @param documentId Document id
     */
    constructor(documentId: string) {
        this._documentId = documentId;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(store: IDocumentStore, conventions: DocumentConventions, httpCache: HttpCache): RavenCommand<TimeSeriesStatistics> {
        return new GetTimeSeriesStatisticsCommand(conventions, this._documentId);
    }
}

class GetTimeSeriesStatisticsCommand extends RavenCommand<TimeSeriesStatistics> {
    private readonly _conventions: DocumentConventions;
    private readonly _documentId: string;

    public constructor(conventions: DocumentConventions, documentId: string) {
        super();

        this._conventions = conventions;
        this._documentId = documentId;
    }

    get isReadRequest(): boolean {
        return true;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/timeseries/stats?docId=" + this._urlEncode(this._documentId);

        return {
            method: "GET",
            uri
        }
    }

    async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        let body: string = null;

        if (!bodyStream) {
            this.result = null;
            return null;
        }
        const results = await this._defaultPipeline<ServerResponse<TimeSeriesStatistics>>(_ => body = _).process(bodyStream);

        const { timeSeries, ...restProps } = results;

        this.result = {
            ...restProps,
            timeSeries: timeSeries.map(t => {
                const { startDate, endDate } = t;
                return {
                    ...t,
                    startDate: DateUtil.utc.parse(startDate),
                    endDate: DateUtil.utc.parse(endDate)
                }
            })
        }

        return body;
    }
}
