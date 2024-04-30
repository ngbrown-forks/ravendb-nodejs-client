import { IMaintenanceOperation, OperationResultType } from "./OperationAbstractions.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { ServerNode } from "../../Http/ServerNode.js";

export class DatabaseHealthCheckOperation implements IMaintenanceOperation<void> {
    getCommand(conventions: DocumentConventions): RavenCommand<void> {
        return new DatabaseHealthCheckCommand();
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}

class DatabaseHealthCheckCommand extends RavenCommand<void> {

    constructor() {
        super();

        this.timeout = 15_000;
    }

    get isReadRequest(): boolean {
        return true;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/healthcheck";

        return {
            method: "GET",
            uri
        }
    }
}