import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { ClientConfiguration } from "./ClientConfiguration.js";
import { throwError } from "../../../Exceptions/index.js";
import { RavenCommand, RavenCommandResponseType } from "../../../Http/RavenCommand.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { HeadersBuilder } from "../../../Utility/HttpUtil.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";

export class PutClientConfigurationOperation implements IMaintenanceOperation<void> {
    private readonly _configuration: ClientConfiguration;

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    public constructor(configuration: ClientConfiguration) {

        if (!configuration) {
            throwError("InvalidArgumentException", "Configuration cannot be null or undefined.");
        }

        this._configuration = configuration;
    }

    public getCommand(conventions: DocumentConventions): RavenCommand<void> {
        return new PutClientConfigurationCommand(conventions, this._configuration);
    }

}

export class PutClientConfigurationCommand extends RavenCommand<void> implements IRaftCommand {
    private readonly _configuration: string;

    public get isReadRequest() {
        return false;
    }

    public get responseType(): RavenCommandResponseType {
        return "Empty";
    }

    public constructor(conventions: DocumentConventions, configuration: ClientConfiguration) {
        super();

        if (!conventions) {
            throwError("InvalidArgumentException", "Document conventions cannot be null or undefined.");
        }

        if (!configuration) {
            throwError("InvalidArgumentException", "Configuration cannot be null or undefined.");
        }

        this._configuration = this._serializer.serialize(configuration);
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = `${node.url}/databases/${node.database}/admin/configuration/client`;
        return {
            method: "PUT",
            uri,
            body: this._configuration,
            headers: HeadersBuilder.create()
                .typeAppJson()
                .build()
        };
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}
