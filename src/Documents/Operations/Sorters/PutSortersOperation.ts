import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { SorterDefinition } from "../../Queries/Sorting/SorterDefinition.js";
import { throwError } from "../../../Exceptions/index.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";

export class PutSortersOperation implements IMaintenanceOperation<void> {
    private readonly _sortersToAdd: SorterDefinition[];

    public constructor(...sortersToAdd: SorterDefinition[]) {
        if (!sortersToAdd || !sortersToAdd.length) {
            throwError("InvalidArgumentException", "SortersToAdd cannot be null or empty");
        }

        this._sortersToAdd = sortersToAdd;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    public getCommand(conventions: DocumentConventions): RavenCommand<void> {
        return new PutSortersCommand(conventions, this._sortersToAdd);
    }
}

class PutSortersCommand extends RavenCommand<void> implements IRaftCommand {
    private readonly _sortersToAdd: SorterDefinition[];

    public constructor(conventions: DocumentConventions, sortersToAdd: SorterDefinition[]) {
        super();

        if (!conventions) {
            throwError("InvalidArgumentException", "Conventions cannot be null");
        }

        if (!sortersToAdd) {
            throwError("InvalidArgumentException", "SortersToAdd cannot be null");
        }

        if (sortersToAdd.some(x => !x) ) {
            throwError("InvalidArgumentException", "Sorter cannot be null");
        }

        this._sortersToAdd = sortersToAdd;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/admin/sorters";

        const body = this._serializer.serialize({
            sorters: this._sortersToAdd
        });

        return {
            uri,
            method: "PUT",
            headers: this._headers().typeAppJson().build(),
            body
        }
    }

    get isReadRequest(): boolean {
        return false;
    }

    getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}
