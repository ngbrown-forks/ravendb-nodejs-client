import { IServerOperation, OperationResultType } from "../../../Documents/Operations/OperationAbstractions.js";
import { throwError } from "../../../Exceptions/index.js";
import { DocumentConventions } from "../../../Documents/Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";

export class DeleteServerWideAnalyzerOperation implements IServerOperation<void> {
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
        return new DeleteServerWideAnalyzerCommand(this._analyzerName);
    }
}

class DeleteServerWideAnalyzerCommand extends RavenCommand<void> implements IRaftCommand {
    private readonly _analyzerName: string;

    public constructor(analyzerName: string) {
        super();

        if (!analyzerName) {
            throwError("InvalidArgumentException", "AnalyzerName cannot be null");
        }

        this._analyzerName = analyzerName;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/admin/analyzers?name=" + this._urlEncode(this._analyzerName);

        return {
            uri,
            method: "DELETE"
        }
    }

    get isReadRequest(): boolean {
        return false;
    }

    getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}