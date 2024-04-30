import { BuildNumber } from "./BuildNumber.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { Stream } from "node:stream";
import { IServerOperation, OperationResultType } from "../../Documents/Operations/OperationAbstractions.js";
import { DocumentConventions } from "../../Documents/Conventions/DocumentConventions.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { ServerNode } from "../../Http/ServerNode.js";

export class GetBuildNumberOperation implements IServerOperation<BuildNumber> {
    getCommand(conventions: DocumentConventions): RavenCommand<BuildNumber> {
        return new GetBuildNumberCommand();
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}

class GetBuildNumberCommand extends RavenCommand<BuildNumber> {
    get isReadRequest(): boolean {
        return true;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/build/version";

        return {
            uri,
            method: "GET"
        }
    }

    async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        return this._parseResponseDefaultAsync(bodyStream);
    }
}
