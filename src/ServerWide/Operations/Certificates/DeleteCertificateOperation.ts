import { throwError } from "../../../Exceptions/index.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { IServerOperation, OperationResultType } from "../../../Documents/Operations/OperationAbstractions.js";
import { DocumentConventions } from "../../../Documents/Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";

export class DeleteCertificateOperation implements IServerOperation<void> {

    private readonly _thumbprint: string;

    public constructor(thumbprint: string) {
        if (!thumbprint) {
            throwError("InvalidArgumentException", "Thumbprint cannot be null.");
        }

        this._thumbprint = thumbprint;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<void> {
        return new DeleteCertificateCommand(this._thumbprint);
    }
}

class DeleteCertificateCommand extends RavenCommand<void> implements IRaftCommand {
    private readonly _thumbprint: string;

    public constructor(thumbprint: string) {
        super();
        if (!thumbprint) {
            throwError("InvalidArgumentException", "Thumbprint cannot be null");
        }

        this._thumbprint = thumbprint;
    }

    get isReadRequest(): boolean {
        return false;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/admin/certificates?thumbprint=" + encodeURIComponent(this._thumbprint);

        return {
            uri,
            method: "DELETE"
        }
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}