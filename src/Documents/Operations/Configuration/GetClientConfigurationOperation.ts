import { Stream } from "node:stream";
import { ServerNode } from "../../../Http/ServerNode.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { ClientConfiguration } from "./ClientConfiguration.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";

export class GetClientConfigurationOperation implements IMaintenanceOperation<GetClientConfigurationOperationResult> {

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    public getCommand(conventions: DocumentConventions): RavenCommand<GetClientConfigurationOperationResult> {
        return new GetClientConfigurationCommand();
    }
}

export class GetClientConfigurationCommand extends RavenCommand<GetClientConfigurationOperationResult> {

    constructor() {
        super();
    }

    public get isReadRequest(): boolean {
        return false;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = `${ node.url }/databases/${ node.database }/configuration/client`;
        return { uri };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        const body = await this._parseResponseDefaultAsync(bodyStream);

        // since server can send etag bigger than Number.MAX_SAFE_INTEGER we need to parse Etag as string
        const match = body.match("\"Etag\":(-?[0-9]+)");
        if (match) {
            this.result.etag = match[1];
        }

        return body;
    }
}

export interface GetClientConfigurationOperationResult {
    etag: string;
    configuration: ClientConfiguration;
}
