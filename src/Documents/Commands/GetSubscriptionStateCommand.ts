import { RavenCommand } from "../../Http/RavenCommand.js";
import { SubscriptionState } from "../Subscriptions/SubscriptionState.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { Stream } from "node:stream";
import { ServerNode } from "../../Http/ServerNode.js";

export class GetSubscriptionStateCommand extends RavenCommand<SubscriptionState> {

    private readonly _subscriptionName: string;

    public constructor(subscriptionName: string) {
        super();
        this._subscriptionName = subscriptionName;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/subscriptions/state?name=" + this._urlEncode(this._subscriptionName);

        return {
            uri
        };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        return this._parseResponseDefaultAsync(bodyStream);
    }

    public get isReadRequest() {
        return true;
    }
}
