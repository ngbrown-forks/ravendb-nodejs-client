
import { CreateDatabaseCommand } from "./CreateDatabaseOperation.js";
import { IServerOperation, OperationResultType } from "../../Documents/Operations/OperationAbstractions.js";
import { DatabasePutResult } from "./index.js";
import { DatabaseRecord } from "../index.js";
import { DocumentConventions } from "../../Documents/Conventions/DocumentConventions.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { throwError } from "../../Exceptions/index.js";

export class UpdateDatabaseOperation implements IServerOperation<DatabasePutResult> {
    private readonly _databaseRecord: DatabaseRecord;
    private readonly _etag: number;
    private readonly _replicationFactor: number;

    public constructor(databaseRecord: DatabaseRecord, etag: number, replicationFactor?: number) {
        this._databaseRecord = databaseRecord;
        this._etag = etag;
        const topology = databaseRecord.topology;

        if (replicationFactor) {
            this._replicationFactor = replicationFactor;
        } else {
            if (topology && topology.replicationFactor > 0) {
                this._replicationFactor = topology.replicationFactor;
            } else {
                throwError("InvalidArgumentException", "DatabaseRecord.Topology.ReplicationFactor is missing");
            }
        }
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    getCommand(conventions: DocumentConventions): RavenCommand<DatabasePutResult> {
        return new CreateDatabaseCommand(conventions, this._databaseRecord, this._replicationFactor, this._etag);
    }
}
