import { QueryResult } from "../Queries/QueryResult.js";

export class QueryStatistics {

    public isStale: boolean;
    public durationInMs: number;
    public totalResults: number;
    public skippedResults: number;
    public scannedResults: number;
    public timestamp: Date;
    public indexName: string;
    public indexTimestamp: Date;
    public lastQueryTime: Date;
    public resultEtag: number;

    public nodeTag: string;
    public requestedByUser: boolean;

    public updateQueryStats(qr: QueryResult): void {
        this.isStale = qr.isStale;
        this.durationInMs = qr.durationInMs;
        this.totalResults = qr.totalResults;
        this.skippedResults = qr.skippedResults;
        this.scannedResults = qr.scannedResults;
        this.timestamp = qr.indexTimestamp;
        this.indexName = qr.indexName;
        this.indexTimestamp = qr.indexTimestamp;
        this.lastQueryTime = qr.lastQueryTime;
        this.resultEtag = qr.resultEtag;
        this.nodeTag = qr.nodeTag;
    }
}
