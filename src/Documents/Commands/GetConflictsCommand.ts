import { HttpRequestParameters } from "../../Primitives/Http.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { GetConflictsResult } from "./GetConflictsResult.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { Stream } from "node:stream";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";
import { ServerResponse } from "../../Types/index.js";
import { DateUtil } from "../../Utility/DateUtil.js";

export class GetConflictsCommand extends RavenCommand<GetConflictsResult> {

    private readonly _id: string;
    private readonly _conventions: DocumentConventions;

    public constructor(id: string, conventions: DocumentConventions) {
        super();
        this._id = id;
        this._conventions = conventions;
    }

    public get isReadRequest(): boolean {
        return true;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database
            + "/replication/conflicts?docId=" + encodeURIComponent(this._id);
        return {
            method: "GET",
            uri
        };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        let body: string = null;
        const payload = await this._defaultPipeline<ServerResponse<GetConflictsResult>>(_ => body = _).process(bodyStream);

        const { results, ...otherProps } = payload;

        this.result = {
            ...otherProps,
            results: results.map(r => ({
                ...r,
                lastModified: DateUtil.utc.parse(r.lastModified)
            }))
        };

        return body;
    }
}
