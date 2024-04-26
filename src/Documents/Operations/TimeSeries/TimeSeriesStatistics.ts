import { TimeSeriesItemDetail } from "./TimeSeriesItemDetail.js";

export interface TimeSeriesStatistics {
    documentId: string;
    timeSeries: TimeSeriesItemDetail[];
}