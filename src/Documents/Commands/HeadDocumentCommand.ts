import { StatusCodes } from "../../Http/StatusCode.js";
import { HttpRequestParameters, HttpResponse } from "../../Primitives/Http.js";
import { ResponseDisposeHandling, RavenCommand } from "../../Http/RavenCommand.js";
import { throwError } from "../../Exceptions/index.js";
import { HttpCache } from "../../Http/HttpCache.js";
import { getRequiredEtagHeader } from "../../Utility/HttpUtil.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { Readable } from "node:stream";
import { HEADERS } from "../../Constants.js";

export class HeadDocumentCommand extends RavenCommand<string> {

    private readonly _id: string;
    private readonly _changeVector: string;

    public constructor(id: string, changeVector: string) {
        super();

        if (!id) {
            throwError("InvalidArgumentException", "Id cannot be null.");
        }

        this._id = id;
        this._changeVector = changeVector;
        this._responseType = "Empty";
    }

    public get isReadRequest(): boolean {
        return false;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/docs?id=" + encodeURIComponent(this._id);

        const headers = this._headers()
            .typeAppJson();
        if (this._changeVector) {
            headers.with(HEADERS.IF_NONE_MATCH, this._changeVector);
        }

        return {
            method: "HEAD",
            uri,
            headers: headers.build()
        };
    }

    public async processResponse(
        cache: HttpCache,
        response: HttpResponse,
        bodyStream: Readable,
        url: string): Promise<ResponseDisposeHandling> {
        if (response.status === StatusCodes.NotModified) {
            this.result = this._changeVector;
            return "Automatic";
        }

        if (response.status === StatusCodes.NotFound) {
            this.result = null;
            return "Automatic";
        }

        this.result = getRequiredEtagHeader(response);
        return "Automatic";
    }
}
