import { RavenCommand } from "../../../Http/RavenCommand.js";
import { throwError } from "../../../Exceptions/index.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { Stream } from "node:stream";


export class GetRevisionsCountOperation {
    private readonly _docId: string;

    constructor(docId: string) {
        this._docId = docId;
    }

    public createRequest(): RavenCommand<number> {
        return new GetRevisionsCountCommand(this._docId);
    }
}

class GetRevisionsCountCommand extends RavenCommand<number> {
    private readonly _id: string;

    public constructor(id: string) {
        super();

        if (!id) {
            throwError("InvalidArgumentException", "Id cannot be null");
        }

        this._id = id;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/revisions/count?&id=" + this._urlEncode(this._id);
        return {
            method: "GET",
            uri
        }
    }

    async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        let body: string = null;
        const result = await this._defaultPipeline<{ revisionsCount: number }>(_ => body = _).process(bodyStream);

        this.result = result.revisionsCount;
        return body;
    }

    get isReadRequest(): boolean {
        return true;
    }
}
