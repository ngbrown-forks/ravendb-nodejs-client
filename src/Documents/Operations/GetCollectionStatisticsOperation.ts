import { HttpRequestParameters } from "../../Primitives/Http.js";
import { IMaintenanceOperation, OperationResultType } from "./OperationAbstractions.js";
import { CollectionStatistics } from "./CollectionStatistics.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { Stream } from "node:stream";
import { ObjectUtil } from "../../Utility/ObjectUtil.js";

export class GetCollectionStatisticsOperation implements IMaintenanceOperation<CollectionStatistics> {

    public getCommand(conventions: DocumentConventions): RavenCommand<CollectionStatistics> {
        return new GetCollectionStatisticsCommand();
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

}

export class GetCollectionStatisticsCommand extends RavenCommand<CollectionStatistics> {

    public constructor() {
        super();
    }

    public get isReadRequest(): boolean {
        return true;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/collections/stats";
        return { uri };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        let body: string = null;
        this.result = await this._defaultPipeline(_ => body = _)
            .collectBody()
            .objectKeysTransform({
                defaultTransform: ObjectUtil.camel,
                ignorePaths: [/^collections\./i]
            })
            .process(bodyStream);
        return body;
    }
}
