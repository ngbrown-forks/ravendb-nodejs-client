import { Readable } from "node:stream";
import { RavenCommand, ResponseDisposeHandling } from "../../Http/RavenCommand.js";
import { StreamResultResponse } from "./StreamResultResponse.js";
import { throwError } from "../../Exceptions/index.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { HttpRequestParameters, HttpResponse } from "../../Primitives/Http.js";
import { HttpCache } from "../../Http/HttpCache.js";

export class StreamCommand extends RavenCommand<StreamResultResponse> {
    private readonly _url: string;

    public constructor(url: string) {
        super();

        if (!url) {
            throwError("InvalidArgumentException", "Url cannot be null.");
        }

        this._url = url;
        this._responseType = "Empty";
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        return {
            uri: `${node.url}/databases/${node.database}/${this._url}`
        };
    }

    public async processResponse(
        cache: HttpCache,
        response: HttpResponse,
        bodyStream: Readable,
        url: string): Promise<ResponseDisposeHandling> {
        this.result = {
            response,
            stream: bodyStream
        };

        return "Manually";
    }

    public get isReadRequest() {
        return true;
    }
}
