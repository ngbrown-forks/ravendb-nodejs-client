import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { OperationResultType, IMaintenanceOperation } from "../OperationAbstractions.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { Stream } from "node:stream";

export interface IdentitiesCollection {
    [key: string]: number;
}

export class GetIdentitiesOperation implements IMaintenanceOperation<IdentitiesCollection> {

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    public getCommand(conventions: DocumentConventions): RavenCommand<IdentitiesCollection> {
        return new GetIdentitiesCommand();
    }
}

export class GetIdentitiesCommand extends RavenCommand<IdentitiesCollection> {

    public constructor() {
        super();
    }

    public get isReadRequest(): boolean {
        return true;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/debug/identities";
        return { uri };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        let body: string = null;
        this.result = await this._pipeline<IdentitiesCollection>()
            .parseJsonSync()
            .collectBody(b => body = b)
            .process(bodyStream);
        return body;
    }
}
