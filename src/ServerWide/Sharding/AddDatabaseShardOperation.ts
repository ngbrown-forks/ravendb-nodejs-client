import { IServerOperation, OperationResultType } from "../../Documents/Operations/OperationAbstractions.js";
import { DatabaseTopology } from "../Operations/index.js";
import { DocumentConventions } from "../../Documents/Conventions/DocumentConventions.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { TypeUtil } from "../../Utility/TypeUtil.js";
import { Stream } from "node:stream";
import { IRaftCommand } from "../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../Utility/RaftIdGenerator.js";

interface AddDatabaseShardParameters {
    databaseName: string;
    shardNumber?: number;
    dynamicNodeDistribution?: boolean;
    replicationFactor?: number;
    nodes?: string[];
}

export class AddDatabaseShardOperation implements IServerOperation<AddDatabaseShardResult> {
    private readonly _databaseName: string;
    private readonly _shardNumber: number;
    private readonly _nodes: string[];
    private readonly _replicationFactor: number;
    private readonly _dynamicNodeDistribution: boolean;

    public constructor(parameters: AddDatabaseShardParameters) {
        this._databaseName = parameters.databaseName;
        this._shardNumber = parameters.shardNumber;
        this._nodes = parameters.nodes;
        this._replicationFactor = parameters.replicationFactor;
        this._dynamicNodeDistribution = parameters.dynamicNodeDistribution;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<AddDatabaseShardResult> {
        return new AddDatabaseShardCommand(this._databaseName, this._shardNumber, this._nodes, this._replicationFactor, this._dynamicNodeDistribution);
    }
}

class AddDatabaseShardCommand extends RavenCommand<AddDatabaseShardResult> implements IRaftCommand {
    private readonly _databaseName: string;
    private readonly _shardNumber: number;
    private readonly _nodes: string[];
    private readonly _replicationFactor: number;
    private readonly _dynamicNodeDistribution: boolean;


    constructor(databaseName: string, shardNumber: number, nodes: string[], replicationFactor: number, dynamicNodeDistribution: boolean) {
        super();
        this._databaseName = databaseName;
        this._shardNumber = shardNumber;
        this._nodes = nodes;
        this._replicationFactor = replicationFactor;
        this._dynamicNodeDistribution = dynamicNodeDistribution;
    }

    get isReadRequest(): boolean {
        return false;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        let uri = node.url + "/admin/databases/shard?name=" + this._urlEncode(this._databaseName);

        if (!TypeUtil.isNullOrUndefined(this._shardNumber)) {
           uri += "&shardNumber=" + this._shardNumber;
        }

        if (!TypeUtil.isNullOrUndefined(this._replicationFactor)) {
            uri += "&replicationFactor=" + this._replicationFactor;
        }

        if (!TypeUtil.isNullOrUndefined(this._dynamicNodeDistribution)) {
            uri += "&dynamicNodeDistribution=" + this._dynamicNodeDistribution;
        }

        if (this._nodes && this._nodes.length > 0) {
            for (const nodeStr of this._nodes) {
                uri += "&node=" + this._urlEncode(nodeStr);
            }
        }

        return {
            uri,
            method: "PUT"
        };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        return this._parseResponseDefaultAsync(bodyStream);
    }

    getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}

export interface AddDatabaseShardResult {
    name: string;
    shardNumber: number;
    shardTopology: DatabaseTopology;
    raftCommandIndex: number;
}