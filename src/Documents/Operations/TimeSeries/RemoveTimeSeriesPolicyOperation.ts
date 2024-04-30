import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { ConfigureTimeSeriesOperationResult } from "./ConfigureTimeSeriesOperationResult.js";
import { throwError } from "../../../Exceptions/index.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { Stream } from "node:stream";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";

export class RemoveTimeSeriesPolicyOperation implements IMaintenanceOperation<ConfigureTimeSeriesOperationResult> {
    private readonly _collection: string;
    private readonly _name: string;

    public constructor(collection: string, name: string) {
        if (!collection) {
            throwError("InvalidArgumentException", "Name cannot be null");
        }

        if (!name) {
            throwError("InvalidArgumentException", "Collection cannot be null");
        }

        this._collection = collection;
        this._name = name;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }


    getCommand(conventions: DocumentConventions): RavenCommand<ConfigureTimeSeriesOperationResult> {
        return new RemoveTimeSeriesPolicyCommand(this._collection, this._name);
    }
}

class RemoveTimeSeriesPolicyCommand extends RavenCommand<ConfigureTimeSeriesOperationResult> implements IRaftCommand {
    private readonly _collection: string;
    private readonly _name: string;

    public constructor(collection: string, name: string) {
        super();

        this._collection = collection;
        this._name = name;
    }

    get isReadRequest(): boolean {
        return false;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database
            + "/admin/timeseries/policy?collection=" + this._urlEncode(this._collection)
            + "&name=" + this._urlEncode(this._name);

        return {
            method: "DELETE",
            uri
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
