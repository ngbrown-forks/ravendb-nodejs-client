import { CommandType } from "../CommandData.js";
import { TimeSeriesCommandData } from "./TimeSeriesCommandData.js";
import { IncrementOperation } from "../../Operations/TimeSeries/TimeSeriesOperation.js";


export class IncrementalTimeSeriesBatchCommandData extends TimeSeriesCommandData {

    public constructor(documentId: string, name: string, increments: IncrementOperation[]) {
        super(documentId, name);

        if (increments) {
            for (const incrementOperation of increments) {
                this.timeSeries.increment(incrementOperation);
            }
        }
    }

    public get type(): CommandType {
        return "TimeSeriesWithIncrements";
    }
}
