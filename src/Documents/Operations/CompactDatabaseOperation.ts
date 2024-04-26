import { HttpRequestParameters } from "../../Primitives/Http.js";
import { IServerOperation, OperationIdResult, OperationResultType } from "./OperationAbstractions.js";
import { CompactSettings } from "../../ServerWide/CompactSettings.js";
import { throwError } from "../../Exceptions/index.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { Stream } from "node:stream";

export class CompactDatabaseOperation implements IServerOperation<OperationIdResult> {

    private readonly _compactSettings: CompactSettings;

    public constructor(compactSettings: CompactSettings) {
        if (!compactSettings) {
            throwError("InvalidArgumentException", "CompactSettings cannot be null");
        }

        this._compactSettings = compactSettings;
    }

    public getCommand(conventions: DocumentConventions): RavenCommand<OperationIdResult> {
        return new CompactDatabaseCommand(conventions, this._compactSettings);
    }

    public get resultType(): OperationResultType {
        return "OperationId";
    }

}

export class CompactDatabaseCommand extends RavenCommand<OperationIdResult> {
    private readonly _compactSettings: CompactSettings;

    public constructor(conventions: DocumentConventions, compactSettings: CompactSettings) {
        super();

        if (!conventions) {
            throwError("InvalidArgumentException", "Conventions cannot be null");
        }

        if (!compactSettings) {
            throwError("InvalidArgumentException", "CompactSettings cannot be null");
        }

        this._compactSettings = compactSettings;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/admin/compact";
        const body = this._serializer.serialize(this._compactSettings);

        return {
            method: "POST",
            body,
            uri,
            headers: this._headers().typeAppJson().build()
        };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        return this._parseResponseDefaultAsync(bodyStream);
    }

    public get isReadRequest(): boolean {
        return false;
    }
}
