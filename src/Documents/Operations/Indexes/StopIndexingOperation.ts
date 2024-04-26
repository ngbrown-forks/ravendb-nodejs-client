import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";

export class StopIndexingOperation implements IMaintenanceOperation<void> {

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    public getCommand(conventions: DocumentConventions): RavenCommand<void> {
        return new StopIndexingCommand();
    }

}

export class StopIndexingCommand extends RavenCommand<void> {
    public get isReadRequest() {
        return false;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/admin/indexes/stop";

        return {
            method: "POST",
            uri
        };
    }
}
