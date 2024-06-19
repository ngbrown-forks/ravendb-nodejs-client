import { IServerOperation, OperationResultType } from "../../Documents/Operations/OperationAbstractions.js";
import { ModifyDatabaseTopologyResult } from "./ModifyDatabaseTopologyResult.js";
import { DatabaseTopology } from "./index.js";
import { throwError } from "../../Exceptions/index.js";
import { DocumentConventions } from "../../Documents/Conventions/DocumentConventions.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { IRaftCommand } from "../../Http/IRaftCommand.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { RaftIdGenerator } from "../../Utility/RaftIdGenerator.js";
import { Stream } from "node:stream";
import { TypeUtil } from "../../Utility/TypeUtil.js";
import { ClientShardHelper } from "../../Utility/ClientShardHelper.js";

export class ModifyDatabaseTopologyOperation implements IServerOperation<ModifyDatabaseTopologyResult> {
    private readonly _databaseName: string;
    private readonly _databaseTopology: DatabaseTopology;

    public constructor(databaseName: string, databaseTopology: DatabaseTopology)
    public constructor(databaseName: string, shardNumber: number, databaseTopology: DatabaseTopology)
    public constructor(databaseName: string, databaseTopologyOrShardNumber: DatabaseTopology | number, databaseTopology?: DatabaseTopology) {
        if (TypeUtil.isNullOrUndefined(databaseTopologyOrShardNumber)) {
            throwError("InvalidArgumentException", "DatabaseTopology cannot be null")
        }

        if (TypeUtil.isNumber(databaseTopologyOrShardNumber)) {
            this._databaseTopology = databaseTopology;
            this._databaseName = ClientShardHelper.toShardName(databaseName, databaseTopologyOrShardNumber);
        } else {
            this._databaseName = databaseName;
            this._databaseTopology = databaseTopology;
        }

    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<ModifyDatabaseTopologyResult> {
        return new ModifyDatabaseTopologyCommand(this._databaseName, this._databaseTopology);
    }
}

class ModifyDatabaseTopologyCommand extends RavenCommand<ModifyDatabaseTopologyResult> implements IRaftCommand {
    private readonly _databaseName: string;
    private readonly _databaseTopology: DatabaseTopology;

    public constructor(databaseName: string, databaseTopology: DatabaseTopology) {
        super();
        if (!databaseTopology) {
            throwError("InvalidArgumentException", "DatabaseTopology cannot be null")
        }

        this._databaseTopology = databaseTopology;
        this._databaseName = databaseName;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/admin/databases/topology/modify?name=" + this._databaseName;

        const body = this._serializer.serialize(this._databaseTopology);

        return {
            uri,
            method: "POST",
            body,
            headers: this._headers().typeAppJson().build(),
        }
    }

    get isReadRequest(): boolean {
        return false;
    }

    getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        let body: string = null;
        this.result = await this._defaultPipeline(_ => body = _)
            .process(bodyStream);
        return body;
    }
}
