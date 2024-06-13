import { IServerOperation, OperationResultType } from "../../Documents/Operations/OperationAbstractions.js";
import { OrchestratorTopology } from "../OrchestratorTopology.js";
import { DocumentConventions } from "../../Documents/Conventions/DocumentConventions.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { IRaftCommand } from "../../Http/IRaftCommand.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { RaftIdGenerator } from "../../Utility/RaftIdGenerator.js";
import { Stream } from "node:stream";

export class AddNodeToOrchestratorTopologyOperation implements IServerOperation<ModifyOrchestratorTopologyResult> {
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
        return new AddNodeToOrchestratorTopologyCommand(this._databaseName, this._node);
    }
}

class AddNodeToOrchestratorTopologyCommand extends RavenCommand<ModifyOrchestratorTopologyResult> implements IRaftCommand {
    private readonly _databaseName: string;
    private readonly _node: string;

    public constructor(databaseName: string, node?: string) {
        super();
        this._databaseName = databaseName;
        this._node = node;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        let uri = node.url + "/admin/databases/orchestrator?name=" + this._urlEncode(this._databaseName);

        if (this._node) {
            uri += "&node=" + this._urlEncode(this._node);
        }
        return {
            uri,
            method: "PUT"
        };
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

export interface ModifyOrchestratorTopologyResult {
    name: string;
    orchestratorTopology: OrchestratorTopology;
    raftCommandIndex: number;
}