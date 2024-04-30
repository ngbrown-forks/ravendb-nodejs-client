import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { throwError } from "../../../Exceptions/index.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";

export class DeleteIndexOperation implements IMaintenanceOperation<void> {
    private readonly _indexName: string;

    public constructor(indexName: string) {
        if (!indexName) {
            throwError("InvalidArgumentException", "Index name cannot be null.");
        }

        this._indexName = indexName;
    }

    public getCommand(conventions: DocumentConventions): RavenCommand<void> {
        return new DeleteIndexCommand(this._indexName);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}

export class DeleteIndexCommand extends RavenCommand<void> implements IRaftCommand {
    private readonly _indexName: string;

    public constructor(indexName: string) {
        super();

        this._responseType = "Empty";

        if (!indexName) {
            throwError("InvalidArgumentException", "Index name cannot be null.");
        }

        this._indexName = indexName;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database
            + "/indexes?name=" + encodeURIComponent(this._indexName);
        return { method: "DELETE", uri };
    }

    public get isReadRequest() {
        return false;
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}
