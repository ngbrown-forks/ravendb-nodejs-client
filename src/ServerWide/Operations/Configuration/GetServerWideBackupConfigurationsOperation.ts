import { IServerOperation, OperationResultType } from "../../../Documents/Operations/OperationAbstractions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { DocumentConventions } from "../../../Documents/Conventions/DocumentConventions.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { Stream } from "node:stream";
import { ServerWideBackupConfiguration } from "./ServerWideBackupConfiguration.js";

export class GetServerWideBackupConfigurationsOperation implements IServerOperation<ServerWideBackupConfiguration[]> {
    getCommand(conventions: DocumentConventions): RavenCommand<ServerWideBackupConfiguration[]> {
        return new GetServerWideBackupConfigurationsCommand();
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}

class GetServerWideBackupConfigurationsCommand extends RavenCommand<ServerWideBackupConfiguration[]> {
    get isReadRequest(): boolean {
        return true;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/admin/configuration/server-wide/tasks?type=Backup";

        return {
            method: "GET",
            uri
        }
    }

    async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        let body: string = null;
        const result = await this._defaultPipeline(_ => body = _).process(bodyStream);

        this.result = result["results"] as ServerWideBackupConfiguration[];

        return body;
    }
}
