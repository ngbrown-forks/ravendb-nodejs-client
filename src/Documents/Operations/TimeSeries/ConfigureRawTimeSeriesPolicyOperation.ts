import { RawTimeSeriesPolicy } from "./RawTimeSeriesPolicy.js";
import { ConfigureTimeSeriesPolicyOperation } from "./ConfigureTimeSeriesPolicyOperation.js";

export class ConfigureRawTimeSeriesPolicyOperation extends ConfigureTimeSeriesPolicyOperation {
    public constructor(collection: string, config: RawTimeSeriesPolicy) {
        super(collection, config);
    }
}
