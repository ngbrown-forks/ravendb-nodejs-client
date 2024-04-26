import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { ConfigureTimeSeriesOperationResult } from "./ConfigureTimeSeriesOperationResult.js";
import { throwError } from "../../../Exceptions/index.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { Stream } from "node:stream";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";
import { StringUtil } from "../../../Utility/StringUtil.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";

export class ConfigureTimeSeriesValueNamesOperation implements IMaintenanceOperation<ConfigureTimeSeriesOperationResult> {
    private readonly _parameters: ConfigureTimeSeriesValueNamesParameters;

    public constructor(parameters: ConfigureTimeSeriesValueNamesParameters) {
        if (!parameters) {
            throwError("InvalidArgumentException", "Parameters cannot be null");
        }

        this._parameters = parameters;

        if (StringUtil.isNullOrEmpty(parameters.collection)) {
            throwError("InvalidArgumentException", "Collection cannot be null or empty");
        }

        if (StringUtil.isNullOrEmpty(parameters.timeSeries)) {
            throwError("InvalidArgumentException", "TimeSeries cannot be null or empty");
        }

        if (!parameters.valueNames || !parameters.valueNames.length) {
            throwError("InvalidArgumentException", "ValueNames cannot be null or empty");
        }
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<ConfigureTimeSeriesOperationResult> {
        return new ConfigureTimeSeriesValueNamesCommand(this._parameters);
    }
}

class ConfigureTimeSeriesValueNamesCommand extends RavenCommand<ConfigureTimeSeriesOperationResult> implements IRaftCommand {
    private readonly _parameters: ConfigureTimeSeriesValueNamesParameters;

    public constructor(parameters: ConfigureTimeSeriesValueNamesParameters) {
        super();

        this._parameters = parameters;
    }

    get isReadRequest(): boolean {
        return false;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/timeseries/names/config";

        const body = this._serializer.serialize(this._parameters);

        return {
            uri,
            method: "POST",
            headers: this._headers().typeAppJson().build(),
            body
        };
    }

    async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        return this._parseResponseDefaultAsync(bodyStream);
    }

    getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}

export interface ConfigureTimeSeriesValueNamesParameters {
    collection: string;
    timeSeries: string;
    valueNames: string[];
    update?: boolean;
}