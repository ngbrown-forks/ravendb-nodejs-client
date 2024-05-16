import { HttpRequestParameters } from "../../Primitives/Http.js";
import { TypeUtil } from "../../Utility/TypeUtil.js";
import { Stream } from "node:stream";
import { GetDocumentsCommand } from "./GetDocumentsCommand.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { IRavenArrayResult } from "../../Types/index.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";

export class GetRevisionsBinEntryCommand extends RavenCommand<IRavenArrayResult> {
    private readonly _conventions: DocumentConventions;
    private readonly _start: number;
    private readonly _pageSize: number;
    private readonly _continuationToken: string;

    public constructor(conventions: DocumentConventions, continuationToken: string)
    public constructor(conventions: DocumentConventions, start: number, pageSize: number)
    public constructor(conventions: DocumentConventions, startOrContinuationToken: number | string, pageSize?: number) {
        super();

        this._conventions = conventions;

        if (TypeUtil.isString(startOrContinuationToken)) {
            this._continuationToken = startOrContinuationToken;
            this._start = 0;
            this._pageSize = null;
            return;
        }


        this._start = startOrContinuationToken;
        this._pageSize = pageSize;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        let uri = node.url + "/databases/" + node.database + "/revisions/bin?start=" + this._start;

        if (TypeUtil.isNullOrUndefined(this._pageSize)) {
            uri += "&pageSize=" + this._pageSize;
        }

        if (this._continuationToken) {
            uri += "&continuationToken=" + this._continuationToken;
        }

        return {
            uri
        };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this.result = null;
            return;
        }

        let body: string = null;
        this.result =
            await GetDocumentsCommand.parseDocumentsResultResponseAsync(
                bodyStream, this._conventions, b => body = b);

        return body as string;
    }

    public get isReadRequest(): boolean {
        return true;
    }
}
