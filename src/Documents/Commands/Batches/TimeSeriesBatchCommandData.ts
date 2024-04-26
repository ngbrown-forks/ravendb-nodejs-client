import { CommandType } from "../CommandData.js";
import { AppendOperation, DeleteOperation } from "../../Operations/TimeSeries/TimeSeriesOperation.js";
import { TimeSeriesCommandData } from "./TimeSeriesCommandData.js";

export class TimeSeriesBatchCommandData extends TimeSeriesCommandData {

    public constructor(documentId: string, name: string, appends: AppendOperation[], deletes: DeleteOperation[]) {
        super(documentId, name);

        if (appends) {
            for (const appendOperation of appends) {
                this.timeSeries.append(appendOperation);
            }
        }

        if (deletes) {
            for (const deleteOperation of deletes) {
                this.timeSeries.delete(deleteOperation);
            }
        }
    }

    public get type(): CommandType {
        return "TimeSeries";
    }
}
