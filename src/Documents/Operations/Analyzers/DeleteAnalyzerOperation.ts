import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { throwError } from "../../../Exceptions/index.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";

export class DeleteAnalyzerOperation implements IMaintenanceOperation<void> {
    private readonly _analyzerName: string;

    public constructor(analyzerName: string) {
        if (!analyzerName) {
            throwError("InvalidArgumentException", "AnalyzerName cannot be null");
        }

        this._analyzerName = analyzerName;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<void> {
        return new DeleteAnalyzerCommand(this._analyzerName);
    }
}

class DeleteAnalyzerCommand extends RavenCommand<void> implements IRaftCommand {
    private readonly _analyzerName: string;

    public constructor(analyzerName: string) {
        super();
        if (!analyzerName) {
            throwError("InvalidArgumentException", "AnalyzerName cannot be null");
        }

        this._analyzerName = analyzerName;
    }

    get isReadRequest(): boolean {
        return false;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/admin/analyzers?name=" + encodeURIComponent(this._analyzerName);

        return {
            uri,
            method: "DELETE"
        }
    }

    getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}