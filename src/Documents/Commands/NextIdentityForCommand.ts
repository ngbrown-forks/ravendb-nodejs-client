import { RavenCommand } from "../../Http/RavenCommand.js";
import { throwError } from "../../Exceptions/index.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { Stream } from "node:stream";
import { IRaftCommand } from "../../Http/IRaftCommand.js";
import { IBroadcast } from "../../Http/IBroadcast.js";
import { RaftIdGenerator } from "../../Utility/RaftIdGenerator.js";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";

export class NextIdentityForCommand extends RavenCommand<number> implements IRaftCommand, IBroadcast {

    private readonly _id: string;
    private _raftUniqueRequestId: string = RaftIdGenerator.newId();

    public constructor(id: string) {
        super();

        if (!id) {
            throwError("InvalidArgumentException", "Id cannot be null");
        }

        this._id = id;
    }

    public get isReadRequest(): boolean {
        return false;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        RavenCommand.ensureIsNotNullOrEmpty(this._id, "id");

        const uri = node.url + "/databases/" + node.database + "/identity/next?name=" + encodeURIComponent(this._id);
        return {
            method: "POST",
            uri
        };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        let body: string = null;
        const results = await this._defaultPipeline(_ => body = _).process(bodyStream);
        if (!results["newIdentityValue"]) {
            this._throwInvalidResponse();
        }

        this.result = results["newIdentityValue"];
        return body;
    }

    getRaftUniqueRequestId(): string {
        return this._raftUniqueRequestId;
    }

    prepareToBroadcast(conventions: DocumentConventions): IBroadcast {
        const copy = new NextIdentityForCommand(this._id);
        copy._raftUniqueRequestId = this._raftUniqueRequestId;

        return copy;
    }
}
