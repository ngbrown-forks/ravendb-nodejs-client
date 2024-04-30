import { RavenCommand } from "../../Http/RavenCommand.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { Stream } from "node:stream";

export class GetNextOperationIdCommand extends RavenCommand<number> {

    private _nodeTag: string;

    public get nodeTag(): string {
        return this._nodeTag;
    }

    public get isReadRequest(): boolean {
        return false; // disable caching
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = `${node.url}/databases/${node.database}/operations/next-operation-id`;
        return { uri };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        let body: string = null;
        const results = await this._defaultPipeline(_ => body = _).process(bodyStream);
        const id = results["id"];
        if (typeof id !== "undefined") {
            this.result = id;
        }

        const nodeTag = results["nodeTag"];
        if (nodeTag) {
            this._nodeTag = nodeTag;
        }
        return body;
    }
}
