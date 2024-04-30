import { RavenCommand } from "../../Http/RavenCommand.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { IRaftCommand } from "../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../Utility/RaftIdGenerator.js";

export class DeleteSubscriptionCommand extends RavenCommand<void> implements IRaftCommand {
    private readonly _name: string;

    public constructor(name: string) {
        super();
        this._name = name;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/subscriptions?taskName=" + this._name;
        return {
            uri,
            method: "DELETE"
        };
    }

    public get isReadRequest() {
        return false;
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}
