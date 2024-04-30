import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { throwError } from "../../../Exceptions/index.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";

export class DeleteSorterOperation implements IMaintenanceOperation<void> {
    private readonly _sorterName: string;

    public constructor(sorterName: string) {
        if (!sorterName) {
            throwError("InvalidArgumentException", "SorterName cannot be null");
        }

        this._sorterName = sorterName;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<void> {
        return new DeleteSorterCommand(this._sorterName);
    }
}

class DeleteSorterCommand extends RavenCommand<void> implements IRaftCommand {
    private readonly _sorterName: string;

    public constructor(sorterName: string) {
        super();

        if (!sorterName) {
            throwError("InvalidArgumentException", "IndexName cannot be null");
        }

        this._sorterName = sorterName;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/admin/sorters?name=" + encodeURIComponent(this._sorterName);

        return {
            uri,
            method: "DELETE"
        }
    }

    get isReadRequest(): boolean {
        return false;
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}