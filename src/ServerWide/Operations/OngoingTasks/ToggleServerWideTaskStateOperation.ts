import { IServerOperation, OperationResultType } from "../../../Documents/Operations/OperationAbstractions.js";
import { OngoingTaskType } from "../../../Documents/Operations/OngoingTasks/OngoingTaskType.js";
import { throwError } from "../../../Exceptions/index.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { DocumentConventions } from "../../../Documents/Conventions/DocumentConventions.js";

export class ToggleServerWideTaskStateOperation implements IServerOperation<void> {
    private readonly _name: string;
    private readonly _type: OngoingTaskType;
    private readonly _disable: boolean;

    public constructor(name: string, type: OngoingTaskType, disable: boolean) {
        if (!name) {
            throwError("InvalidArgumentException", "Name cannot be null");
        }

        this._name = name;
        this._type = type;
        this._disable = disable;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<void> {
        return new ToggleServerWideTaskStateCommand(this._name, this._type, this._disable);
    }
}

class ToggleServerWideTaskStateCommand extends RavenCommand<any> implements IRaftCommand {
    private readonly _name: string;
    private readonly _type: OngoingTaskType;
    private readonly _disable: boolean;

    public constructor(name: string, type: OngoingTaskType, disable: boolean) {
        super();

        if (!name) {
            throwError("InvalidArgumentException", "Name cannot be null");
        }

        this._name = name;
        this._type = type;
        this._disable = disable;
    }

    get isReadRequest(): boolean {
        return false;
    }

    getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/admin/configuration/server-wide/state?type="
            + this._type + "&name=" + this._urlEncode(this._name) + "&disable=" + this._disable;

        return {
            uri,
            method: "POST"
        }
    }
}
