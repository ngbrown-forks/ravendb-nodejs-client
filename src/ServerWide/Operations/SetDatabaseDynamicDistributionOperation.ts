import { IServerOperation, OperationResultType } from "../../Documents/Operations/OperationAbstractions.js";
import { StringUtil } from "../../Utility/StringUtil.js";
import { throwError } from "../../Exceptions/index.js";
import { DocumentConventions } from "../../Documents/Conventions/DocumentConventions.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { IRaftCommand } from "../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../Utility/RaftIdGenerator.js";
import { HttpRequestParameters } from "../../Primitives/Http.js";
import { ServerNode } from "../../Http/ServerNode.js";

export class SetDatabaseDynamicDistributionOperation implements IServerOperation<void> {
    private readonly _allowDynamicDistribution: boolean;
    private readonly _databaseName: string;

    public constructor(databaseName: string, allowDynamicDistribution: boolean) {
        if (StringUtil.isNullOrEmpty(databaseName)) {
            throwError("InvalidArgumentException", "DatabaseName should not be null or empty");
        }

        this._allowDynamicDistribution = allowDynamicDistribution;
        this._databaseName = databaseName;
    }

    public getCommand(conventions: DocumentConventions): RavenCommand<void> {
        return new SetDatabaseDynamicDistributionCommand(this._databaseName, this._allowDynamicDistribution);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}

class SetDatabaseDynamicDistributionCommand extends RavenCommand<void> implements IRaftCommand {
    private readonly _databaseName: string;
    private readonly _allowDynamicDistribution: boolean;

    public constructor(databaseName: string, allowDynamicDistribution: boolean) {
        super();

        this._databaseName = databaseName;
        this._allowDynamicDistribution = allowDynamicDistribution;
    }

    get isReadRequest(): boolean {
        return false;
    }

    createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/admin/databases/dynamic-node-distribution?name=" + this._databaseName + "&enabled=" + this._allowDynamicDistribution;

        return {
            uri,
            method: "POST"
        }
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}
