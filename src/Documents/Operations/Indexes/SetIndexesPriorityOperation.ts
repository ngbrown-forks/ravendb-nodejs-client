import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { TypeUtil } from "../../../Utility/TypeUtil.js";
import { throwError } from "../../../Exceptions/index.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { IndexPriority } from "../../Indexes/Enums.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";

export class SetIndexesPriorityOperation implements IMaintenanceOperation<void> {

    private readonly _parameters: SetIndexesPriorityOperationParameters;

    public constructor(indexName: string, priority: IndexPriority);
    public constructor(parameters: SetIndexesPriorityOperationParameters);
    public constructor(paramsOrIndexName: string | SetIndexesPriorityOperationParameters, priority?: IndexPriority) {
        if (TypeUtil.isString(paramsOrIndexName)) {
            const indexName = paramsOrIndexName as string;
            if (!indexName) {
                throwError("InvalidArgumentException", "IndexName cannot be null.");
            }

            this._parameters = {
                indexNames: [indexName],
                priority
            };
        } else {
            const parameters = paramsOrIndexName as SetIndexesPriorityOperationParameters;
            if (!parameters) {
                throwError("InvalidArgumentException", "Parameters cannot be null.");
            }

            if (!parameters.indexNames || !parameters.indexNames.length) {
                throwError("InvalidArgumentException", "IndexNames cannot be null or empty.");
            }

            this._parameters = parameters;
        }

    }

    public getCommand(conventions: DocumentConventions): RavenCommand<void> {
        return new SetIndexPriorityCommand(conventions, this._parameters);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}

export class SetIndexPriorityCommand extends RavenCommand<void> implements IRaftCommand {

    private readonly _parameters: object;

    public constructor(conventions: DocumentConventions, parameters: SetIndexesPriorityOperationParameters) {
        super();

        if (!conventions) {
            throwError("InvalidArgumentException", "Conventions cannot be null");
        }

        if (!parameters) {
            throwError("InvalidArgumentException", "Parameters cannot be null");
        }

        this._parameters = conventions.objectMapper.toObjectLiteral(parameters);
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/indexes/set-priority";
        const body = this._serializer.serialize(this._parameters);
        const headers = this._headers()
            .typeAppJson().build();

        return {
            uri,
            method: "POST",
            body,
            headers
        };
    }

    public get isReadRequest() {
        return false;
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}

export interface SetIndexesPriorityOperationParameters {
    indexNames: string[];
    priority: IndexPriority;
}
