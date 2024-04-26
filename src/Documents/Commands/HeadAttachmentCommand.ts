import { RavenCommand, ResponseDisposeHandling } from "../../Http/RavenCommand.js";
import { HttpCache } from "../../Http/HttpCache.js";
import { HttpRequestParameters, HttpResponse } from "../../Primitives/Http.js";
import { StringUtil } from "../../Utility/StringUtil.js";
import { throwError } from "../../Exceptions/index.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { StatusCodes } from "../../Http/StatusCode.js";
import { Stream, Readable } from "node:stream";
import { getRequiredEtagHeader } from "../../Utility/HttpUtil.js";
import { HEADERS } from "../../Constants.js";

export class HeadAttachmentCommand extends RavenCommand<string> {

    private readonly _documentId: string;
    private readonly _name: string;
    private readonly _changeVector: string;

    public get isReadRequest(): boolean {
        return false;
    }

    public constructor(documentId: string, name: string, changeVector: string) {
        super();

        if (StringUtil.isNullOrWhitespace(documentId)) {
            throwError("InvalidArgumentException", "DocumentId cannot be null or empty");
        }

        if (StringUtil.isNullOrWhitespace(name)) {
            throwError("InvalidArgumentException", "Name cannot be null or empty");
        }

        this._documentId = documentId;
        this._name = name;
        this._changeVector = changeVector;
        this._responseType = "Empty";
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url
            + "/databases/" + node.database
            + "/attachments?id=" + encodeURIComponent(this._documentId)
            + "&name=" + encodeURIComponent(this._name);

        const req: HttpRequestParameters = {
            method: "HEAD",
            uri
        };

        if (this._changeVector) {
            req.headers[HEADERS.IF_NONE_MATCH] = `"${this._changeVector}"`;
        }

        return req;
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
