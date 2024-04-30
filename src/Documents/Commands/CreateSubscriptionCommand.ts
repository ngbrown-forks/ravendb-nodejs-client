import { RavenCommand } from "../../Http/RavenCommand.js";
import { CreateSubscriptionResult } from "../Subscriptions/CreateSubscriptionResult.js";
import { SubscriptionCreationOptions } from "../Subscriptions/SubscriptionCreationOptions.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { Stream } from "node:stream";
import { ServerNode } from "../../Http/ServerNode.js";
import { IRaftCommand } from "../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../Utility/RaftIdGenerator.js";
import { throwError } from "../../Exceptions/index.js";

export class CreateSubscriptionCommand extends RavenCommand<CreateSubscriptionResult> implements IRaftCommand {
    private readonly _options: SubscriptionCreationOptions;
    private readonly _id: string;

    public constructor(options: SubscriptionCreationOptions, id?: string) {
        super();
        if (!options) {
            throwError("InvalidArgumentException", "Options cannot be null");
        }
        this._options = options;
        this._id = id;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        let uri = node.url + "/databases/" + node.database + "/subscriptions";

        if (this._id) {
            uri += "?id=" + this._urlEncode(this._id);
        }

        const body = this._serializer.serialize(this._options);

        return {
            uri,
            method: "PUT",
            body
        };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        return this._parseResponseDefaultAsync(bodyStream);
    }

    public get isReadRequest() {
        return false;
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}
