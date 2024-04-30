import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { ConfigureTimeSeriesOperationResult } from "./ConfigureTimeSeriesOperationResult.js";
import { TimeSeriesPolicy } from "./TimeSeriesPolicy.js";
import { throwError } from "../../../Exceptions/index.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { Stream } from "node:stream";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";

export class ConfigureTimeSeriesPolicyOperation implements IMaintenanceOperation<ConfigureTimeSeriesOperationResult> {
    private readonly _collection: string;
    private readonly _config: TimeSeriesPolicy;

    public constructor(collection: string, config: TimeSeriesPolicy) {
        this._collection = collection;
        this._config = config;
    }

    getCommand(conventions: DocumentConventions): RavenCommand<ConfigureTimeSeriesOperationResult> {
        return new ConfigureTimeSeriesPolicyCommand(this._collection, this._config);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}

class ConfigureTimeSeriesPolicyCommand extends RavenCommand<ConfigureTimeSeriesOperationResult> implements IRaftCommand {
    private readonly _configuration: TimeSeriesPolicy;
    private readonly _collection: string;

    public constructor(collection: string, configuration: TimeSeriesPolicy) {
        super();

        if (!configuration) {
            throwError("InvalidArgumentException", "Configuration cannot be null");
        }

        if (!collection) {
            throwError("InvalidArgumentException", "Collection cannot be null");
        }

        this._configuration = configuration;
        this._collection = collection;
    }

    get isReadRequest(): boolean {
        return false;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/admin/timeseries/policy?collection=" + this._urlEncode(this._collection);

        const body = this._serializer.serialize(this._configuration.serialize());

        return {
            method: "PUT",
            uri,
            body,
            headers: this._headers().typeAppJson().build()
        }
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
