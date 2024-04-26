import { throwError } from "../../../Exceptions/index.js";
import { LogMode } from "./LogMode.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { IServerOperation, OperationResultType } from "../../../Documents/Operations/OperationAbstractions.js";
import { DocumentConventions } from "../../../Documents/Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";

export class SetLogsConfigurationOperation implements IServerOperation<void> {
    private readonly _parameters: SetLogsConfigurationParameters;

    public constructor(parameters: SetLogsConfigurationParameters) {
        if (!parameters) {
            throwError("InvalidArgumentException", "Parameters cannot be null");
        }

        this._parameters = parameters;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<void> {
        return new SetLogsConfigurationCommand(this._parameters);
    }
}

class SetLogsConfigurationCommand extends RavenCommand<void> {
    private readonly _parameters: SetLogsConfigurationParameters;

    public constructor(parameters: SetLogsConfigurationParameters) {
        super();

        if (!parameters) {
            throwError("InvalidArgumentException", "Parameters cannot be null");
        }

        this._parameters = parameters;
    }

    get isReadRequest(): boolean {
        return false;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/admin/logs/configuration";

        const body = this._serializer.serialize(this._parameters);

        return {
            uri,
            method: "POST",
            headers: this._headers().typeAppJson().build(),
            body
        }
    }
}

export interface SetLogsConfigurationParameters {
    mode: LogMode;
    retentionTime?: string;
    retentionSize?: number;
    compress?: boolean;
    persist?: boolean;
}