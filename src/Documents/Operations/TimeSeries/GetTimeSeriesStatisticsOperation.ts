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
        const results = await this._defaultPipeline<ServerResponse<TimeSeriesStatistics>>(_ => body = _).process(bodyStream);

        const { timeSeries, ...restProps } = results;

        const dateUtil = this._conventions.dateUtil;

        this.result = {
            ...restProps,
            timeSeries: timeSeries.map(t => {
                const { startDate, endDate } = t;
                return {
                    ...t,
                    startDate: dateUtil.parse(startDate),
                    endDate: dateUtil.parse(endDate)
                }
            })
        }

        return body;
    }
}
