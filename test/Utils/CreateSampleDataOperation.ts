import {
    DatabaseItemType,
    DocumentConventions,
    IRaftCommand,
    OperationResultType,
    ServerNode,
    RavenCommand,
    IMaintenanceOperation
} from "../../src/index.js";
import { HttpRequestParameters } from "../../src/Primitives/Http.js";
import { RaftIdGenerator } from "../../src/Utility/RaftIdGenerator.js";

export class CreateSampleDataOperation implements IMaintenanceOperation<void> {

    private _operateOnTypes: DatabaseItemType[];

    public constructor(operateOnTypes: DatabaseItemType[] = [ "Documents" ]) {
        this._operateOnTypes = operateOnTypes;
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    public getCommand(conventions: DocumentConventions): RavenCommand<void> {
        return new CreateSampleDataCommand(this._operateOnTypes);
    }
}

export class CreateSampleDataCommand extends RavenCommand<void> implements IRaftCommand {

    private _operateOnTypes: DatabaseItemType[];

    constructor(operateOnTypes: DatabaseItemType[]) {
        super();
        this._operateOnTypes = operateOnTypes;
        this._responseType = "Empty";
    }

    public get isReadRequest(): boolean {
        return false;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        let uri = `${node.url}/databases/${node.database}/studio/sample-data`;
        uri += "?" + this._operateOnTypes.map(x => "operateOnTypes=" + x).join("&");

        return {
            method: "POST",
            uri
        };
    }

    getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }
}
