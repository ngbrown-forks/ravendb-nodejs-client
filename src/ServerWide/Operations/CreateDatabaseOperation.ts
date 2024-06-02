import { Stream } from "node:stream";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { DatabasePutResult } from "./index.js";
import { throwError } from "../../Exceptions/index.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { IServerOperation, OperationResultType } from "../../Documents/Operations/OperationAbstractions.js";
import { HeadersBuilder } from "../../Utility/HttpUtil.js";
import { DatabaseRecord } from "../index.js";
import { DocumentConventions } from "../../Documents/Conventions/DocumentConventions.js";
import { HEADERS } from "../../Constants.js";
import { IRaftCommand } from "../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../Utility/RaftIdGenerator.js";

export class CreateDatabaseOperation implements IServerOperation<DatabasePutResult> {

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    private readonly _databaseRecord: DatabaseRecord;
    private readonly _replicationFactor: number;

    public constructor(databaseRecord: DatabaseRecord, replicationFactor?: number) {
        this._databaseRecord = databaseRecord;
        const topology = databaseRecord.topology;
        if (replicationFactor) {
            this._replicationFactor = replicationFactor;
        } else {
            if (topology) {
                this._replicationFactor = topology.replicationFactor > 0 ? topology.replicationFactor : 1;
            } else {
                this._replicationFactor = 1;
            }
        }
    }

    public getCommand(conventions: DocumentConventions): RavenCommand<DatabasePutResult> {
        return new CreateDatabaseCommand(conventions, this._databaseRecord, this._replicationFactor);
    }
}

export class CreateDatabaseCommand extends RavenCommand<DatabasePutResult> implements IRaftCommand {
    private _conventions: DocumentConventions;
    private readonly _databaseRecord: DatabaseRecord;
    private readonly _replicationFactor: number;
    private readonly _dbEtag: number;
    private readonly _databaseName: string;

    public constructor(conventions: DocumentConventions, databaseRecord: DatabaseRecord, replicationFactor: number, etag?: number) {
        super();
        this._conventions = conventions;
        this._databaseRecord = databaseRecord;
        this._replicationFactor = replicationFactor;
        this._dbEtag = etag;

        if (!databaseRecord || !databaseRecord.databaseName) {
            throwError("InvalidOperationException", "Database name is required");
        }

        this._databaseName = databaseRecord.databaseName;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        let uri = node.url + "/admin/databases?name=" + this._databaseName;

        uri += "&replicationFactor=" + this._replicationFactor;

        const databaseDocumentJson = this._serializer.serialize(this._databaseRecord);
        return {
            uri,
            method: "PUT",
            headers: HeadersBuilder.create()
                .typeAppJson()
                .with(HEADERS.ETAG, `"${this._dbEtag}"`)
                .build(),
            body: databaseDocumentJson
        };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        return this._parseResponseDefaultAsync(bodyStream);
    }

    public get isReadRequest(): boolean {
        return false;
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}
