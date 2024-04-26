import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { Stream } from "node:stream";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { IServerOperation, OperationResultType } from "../../../Documents/Operations/OperationAbstractions.js";
import { ClientConfiguration } from "../../../Documents/Operations/Configuration/ClientConfiguration.js";
import { DocumentConventions } from "../../../Documents/Conventions/DocumentConventions.js";
import { ServerNode } from "../../../Http/ServerNode.js";

export class GetServerWideClientConfigurationOperation implements IServerOperation<ClientConfiguration> {
    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<ClientConfiguration> {
        return new GetServerWideClientConfigurationCommand();
    }
}

class GetServerWideClientConfigurationCommand extends RavenCommand<ClientConfiguration> {

    get isReadRequest(): boolean {
        return false;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/configuration/client";

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