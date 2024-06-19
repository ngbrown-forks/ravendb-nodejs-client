import { IMaintenanceOperation, OperationResultType } from "./OperationAbstractions.js";
import { EssentialDatabaseStatistics } from "./EssentialDatabaseStatistics.js";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { Stream } from "node:stream";

export class GetEssentialStatisticsOperation implements IMaintenanceOperation<EssentialDatabaseStatistics> {

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<EssentialDatabaseStatistics> {
        return new GetEssentialStatisticsCommand();
    }
}

class GetEssentialStatisticsCommand extends RavenCommand<EssentialDatabaseStatistics> {

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/stats/essential";

        return {
            method: "GET",
            uri
        }

    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        return this._parseResponseDefaultAsync(bodyStream);
    }

    get isReadRequest(): boolean {
        return true;
    }
}
