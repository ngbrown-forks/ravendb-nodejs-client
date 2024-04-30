import { IMaintenanceOperation, OperationResultType } from "../../../Documents/Operations/OperationAbstractions.js";
import { DocumentCompressionConfigurationResult } from "./DocumentCompressionConfigurationResult.js";
import { DocumentsCompressionConfiguration } from "../../DocumentsCompressionConfiguration.js";
import { throwError } from "../../../Exceptions/index.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { DocumentConventions } from "../../../Documents/Conventions/DocumentConventions.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";
import { Stream } from "node:stream";

export class UpdateDocumentsCompressionConfigurationOperation implements IMaintenanceOperation<DocumentCompressionConfigurationResult> {
    private readonly _documentsCompressionConfiguration: DocumentsCompressionConfiguration;

    public constructor(configuration: DocumentsCompressionConfiguration) {
        if (!configuration) {
            throwError("InvalidArgumentException", "Configuration cannot be null");
        }

        this._documentsCompressionConfiguration = configuration;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<DocumentCompressionConfigurationResult> {
        return new UpdateDocumentCompressionConfigurationCommand(this._documentsCompressionConfiguration);
    }
}

class UpdateDocumentCompressionConfigurationCommand extends RavenCommand<DocumentCompressionConfigurationResult> implements IRaftCommand {
    private _documentsCompressionConfiguration: DocumentsCompressionConfiguration;

    public constructor(configuration: DocumentsCompressionConfiguration) {
        super();

        if (!configuration) {
            throwError("InvalidArgumentException", "Configuration cannot be null");
        }

        this._documentsCompressionConfiguration = configuration;
    }

    get isReadRequest(): boolean {
        return false;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/admin/documents-compression/config";
        const headers = this._headers()
            .typeAppJson().build();
        const body = this._serializer.serialize(this._documentsCompressionConfiguration);

        return {
            uri,
            method: "POST",
            headers,
            body
        }
    }

    async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            return;
        }

        return await this._parseResponseDefaultAsync(bodyStream);
    }

    getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}

