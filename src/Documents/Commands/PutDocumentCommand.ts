import { RavenCommand } from "../../Http/RavenCommand.js";
import { throwError } from "../../Exceptions/index.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { HeadersBuilder } from "../../Utility/HttpUtil.js";
import { Stream } from "node:stream";

export interface PutResult {
    id: string;
    changeVector: string;
}

export class PutDocumentCommand extends RavenCommand<PutResult> {

    private readonly _id: string;
    private readonly _changeVector: string;
    private readonly _document: object;

    public constructor(id: string, changeVector: string, document: object) {
        super();

        if (!id) {
            throwError("InvalidArgumentException", "Id cannot be null or undefined.");
        }

        if (!document) {
            throwError("InvalidArgumentException", "Document cannot be null or undefined.");
        }

        this._id = id;
        this._changeVector = changeVector;
        this._document = document;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = `${node.url}/databases/${node.database}/docs?id=${encodeURIComponent(this._id)}`;

        // we don't use conventions here on purpose
        // doc that's got here should already have proper casing
        const body = JSON.stringify(this._document);
        const req = {
            uri,
            method: "PUT",
            body,
            headers: HeadersBuilder.create()
                .typeAppJson()
                .build()
        };

        this._addChangeVectorIfNotNull(this._changeVector, req);

        return req;
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        return this._parseResponseDefaultAsync(bodyStream);
    }

    public get isReadRequest(): boolean {
        return false;
    }
}
