import { IMaintenanceOperation, OperationResultType } from "./OperationAbstractions.js";
import { DetailedCollectionStatistics } from "./DetailedCollectionStatistics.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { Stream } from "node:stream";

export class GetDetailedCollectionStatisticsOperation implements IMaintenanceOperation<DetailedCollectionStatistics> {
    getCommand(conventions: DocumentConventions): RavenCommand<DetailedCollectionStatistics> {
        return new GetDetailedCollectionStatisticsCommand();
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

}

class GetDetailedCollectionStatisticsCommand extends RavenCommand<DetailedCollectionStatistics> {
    get isReadRequest(): boolean {
        return true;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/collections/stats/detailed";

        return {
            method: "GET",
            uri
        }
    }

    async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        return this._parseResponseDefaultAsync(bodyStream);
    }
}
