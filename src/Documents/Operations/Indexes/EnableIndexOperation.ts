import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { throwError } from "../../../Exceptions/index.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";

export class EnableIndexOperation implements IMaintenanceOperation<void> {

    private readonly _indexName: string;
    private readonly _clusterWide: boolean;

    public constructor(indexName: string, clusterWide: boolean = false) {
        if (!indexName) {
            throwError("InvalidArgumentException", "IndexName cannot be null");
        }

        this._indexName = indexName;
        this._clusterWide = clusterWide;
    }

    public getCommand(conventions: DocumentConventions) {
        return new EnableIndexCommand(this._indexName, this._clusterWide);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}

export class EnableIndexCommand extends RavenCommand<void> implements IRaftCommand {
    private readonly _indexName: string;
    private readonly _clusterWide: boolean;

    public constructor(indexName: string, clusterWide: boolean) {
        super();

        if (!indexName) {
            throwError("InvalidArgumentException", "IndexName cannot be null");
        }

        this._indexName = indexName;
        this._clusterWide = clusterWide || false;
        this._responseType = "Empty";
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url
            + "/databases/" + node.database
            + "/admin/indexes/enable?name=" + encodeURIComponent(this._indexName)
            + "&clusterWide=" + this._clusterWide;
        return {
            method: "POST",
            uri
        };
    }

    public get isReadRequest() {
        return false;
    }

    getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}
