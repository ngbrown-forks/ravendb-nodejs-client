import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { IndexingStatus } from "../../Indexes/IndexingStatus.js";
import { Stream } from "node:stream";

export class GetIndexingStatusOperation implements IMaintenanceOperation<IndexingStatus> {

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    public getCommand(conventions: DocumentConventions): RavenCommand<IndexingStatus> {
        return new GetIndexingStatusCommand();
    }

}

export class GetIndexingStatusCommand extends RavenCommand<IndexingStatus> {

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/indexes/status";
        return { uri };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        return this._parseResponseDefaultAsync(bodyStream);
    }

    public get isReadRequest(): boolean {
        return true;
    }
}
