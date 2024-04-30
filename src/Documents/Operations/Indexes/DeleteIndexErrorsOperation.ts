import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";

export class DeleteIndexErrorsOperation implements IMaintenanceOperation<void> {
    private readonly _indexNames: string[];

    public constructor()
    public constructor(indexNames: string[])
    public constructor(indexNames?: string[]) {
        this._indexNames = indexNames;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<void> {
        return new DeleteIndexErrorsCommand(this._indexNames);
    }
}

class DeleteIndexErrorsCommand extends RavenCommand<void> {

    private readonly _indexNames: string[];

    public constructor(indexNames: string[]) {
        super();

        this._indexNames = indexNames;
    }


    createRequest(node: ServerNode): HttpRequestParameters {
        let uri = node.url + "/databases/" + node.database + "/indexes/errors";

        if (this._indexNames && this._indexNames.length) {
            uri += "?";

            for (const indexName of this._indexNames) {
                uri += "&name=" + this._urlEncode(indexName);
            }
        }

        return {
            uri,
            method: "DELETE"
        }
    }

    get isReadRequest(): boolean {
        return false;
    }
}
