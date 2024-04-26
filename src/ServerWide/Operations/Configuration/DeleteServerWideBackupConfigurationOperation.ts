import { IServerOperation, OperationResultType } from "../../../Documents/Operations/OperationAbstractions.js";
import { throwError } from "../../../Exceptions/index.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { DocumentConventions } from "../../../Documents/Conventions/DocumentConventions.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { ServerNode } from "../../../Http/ServerNode.js";

/**
 * @deprecated Please use DeleteServerWideTaskOperation instead.
 */
export class DeleteServerWideBackupConfigurationOperation implements IServerOperation<void> {
    private readonly _name: string;

    public constructor(name: string) {
        if (!name) {
            throwError("InvalidArgumentException", "Name cannot be null");
        }

        this._name = name;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<void> {
        return new DeleteServerWideBackupConfigurationCommand(this._name);
    }
}

class DeleteServerWideBackupConfigurationCommand extends RavenCommand<void> implements IRaftCommand {
    private readonly _name: string;

    public constructor(name: string) {
        super();

        if (!name) {
            throwError("InvalidArgumentException", "Name cannot be null");
        }

        this._responseType = "Empty";

        this._name = name;
    }

    get isReadRequest(): boolean {
        return false;
    }

    getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/admin/configuration/server-wide/backup?name=" + encodeURIComponent(this._name);

        return {
            method: "DELETE",
            uri
        }
    }
}