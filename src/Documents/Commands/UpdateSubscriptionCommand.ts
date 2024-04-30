import { RaftIdGenerator } from "../../Utility/RaftIdGenerator.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { Stream } from "node:stream";
import { UpdateSubscriptionResult } from "../Subscriptions/UpdateSubscriptionResult.js";
import { SubscriptionUpdateOptions } from "../Subscriptions/SubscriptionUpdateOptions.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { IRaftCommand } from "../../Http/IRaftCommand.js";
import { ServerNode } from "../../Http/ServerNode.js";

export class UpdateSubscriptionCommand extends RavenCommand<UpdateSubscriptionResult> implements IRaftCommand {
    private readonly _options: SubscriptionUpdateOptions;

    public constructor(options: SubscriptionUpdateOptions) {
        super();

        this._options = options;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/subscriptions/update";

        const body = this._serializer.serialize(this._options);

        return {
            uri,
            body,
            headers: this._headers().typeAppJson().build(),
            method: "POST"
        }
    }

    async setResponseFromCache(cachedValue: string): Promise<void> {
        this.result = {
            name: this._options.name
        }
    }

    async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (fromCache) {
            this.result = {
                name: this._options.name
            }

            return;
        }

        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        return this._parseResponseDefaultAsync(bodyStream);
    }

    get isReadRequest(): boolean {
        return false;
    }

    getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}
