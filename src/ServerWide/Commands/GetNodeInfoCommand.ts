import { RavenCommand } from "../../Http/RavenCommand.js";
import { NodeInfo } from "./NodeInfo.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { Stream } from "node:stream";

export class GetNodeInfoCommand extends RavenCommand<NodeInfo> {

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/cluster/node-info";

        return {
            method: "GET",
            uri
        }
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        return this._parseResponseDefaultAsync(bodyStream);
    }

    get isReadRequest(): boolean {
        return true;
    }

}

