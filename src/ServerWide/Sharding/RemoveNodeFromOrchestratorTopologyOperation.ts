import { IServerOperation, OperationResultType } from "../../Documents/Operations/OperationAbstractions.js";
import { ModifyOrchestratorTopologyResult } from "./AddNodeToOrchestratorTopologyOperation.js";
import { DocumentConventions } from "../../Documents/Conventions/DocumentConventions.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { IRaftCommand } from "../../Http/IRaftCommand.js";
import { StringUtil } from "../../Utility/StringUtil.js";
import { throwError } from "../../Exceptions/index.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { Stream } from "node:stream";
import { RaftIdGenerator } from "../../Utility/RaftIdGenerator.js";

export class RemoveNodeFromOrchestratorTopologyOperation implements IServerOperation<ModifyOrchestratorTopologyResult> {
    private readonly _databaseName: string;
    private readonly _node: string;

    public constructor(databaseName: string, node?: string) {
        this._databaseName = databaseName;
        this._node = node;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<ModifyOrchestratorTopologyResult> {
        return new RemoveNodeFromOrchestratorTopologyCommand(this._databaseName, this._node);
    }
}

export class RemoveNodeFromOrchestratorTopologyCommand extends RavenCommand<ModifyOrchestratorTopologyResult> implements IRaftCommand {
    private readonly _databaseName: string;
    private readonly _node: string;

    public constructor(databaseName: string, node?: string) {
        super();
        if (StringUtil.isNullOrEmpty(databaseName)) {
            throwError("InvalidArgumentException", "DatabaseName cannot be null or empty");
        }

        if (StringUtil.isNullOrEmpty(node)) {
            throwError("InvalidArgumentException", "Node cannot be null or empty");
        }

        this._databaseName = databaseName;
        this._node = node;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url +  "/admin/databases/orchestrator?name=" + this._urlEncode(this._databaseName) + "&node=" + this._urlEncode(this._node);

        return {
            uri,
            method: "DELETE"
        }
    }

    async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        return this._parseResponseDefaultAsync(bodyStream);
    }

    get isReadRequest(): boolean {
        return false;
    }

    getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}