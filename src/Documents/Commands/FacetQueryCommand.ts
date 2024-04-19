import { QueryResult } from "../Queries/QueryResult";
import { DocumentConventions } from "../Conventions/DocumentConventions";
import { Stream } from "node:stream";
import { QueryCommand } from "./QueryCommand";
import { RavenCommandResponsePipeline } from "../../Http/RavenCommandResponsePipeline";
import { ServerCasing, ServerResponse } from "../../Types";
import { ObjectUtil } from "../../Utility/ObjectUtil";

export class FacetQueryCommand extends QueryCommand {

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this.result = null;
            return;
        }

        let body: string = null;
        this.result = await FacetQueryCommand.parseQueryResultResponseAsync(
            bodyStream, this._session.conventions, fromCache, b => body = b);

        return body;
    }

    public static async parseQueryResultResponseAsync(
        bodyStream: Stream,
        conventions: DocumentConventions,
        fromCache: boolean,
        bodyCallback?: (body: string) => void): Promise<QueryResult> {

        const rawResult = await RavenCommandResponsePipeline.create<ServerCasing<ServerResponse<QueryResult>>>()
            .collectBody(bodyCallback)
            .parseJsonSync()
            .process(bodyStream);

        const queryResult = FacetQueryCommand.mapToLocalObject(rawResult, conventions);

        if (fromCache) {
            queryResult.durationInMs = -1;
        }

        return queryResult;
    }

    public static mapToLocalObject(json: ServerCasing<ServerResponse<QueryResult>>, conventions: DocumentConventions): QueryResult {
        const { Results, Includes, IndexTimestamp, LastQueryTime, ...rest } = json;

        const restMapped = ObjectUtil.transformObjectKeys(rest, {
            defaultTransform: ObjectUtil.camel
        }) as any;

        return {
            ...restMapped,
            indexTimestamp: conventions.dateUtil.parse(IndexTimestamp),
            lastQueryTime: conventions.dateUtil.parse(LastQueryTime),
            results: Results.map(x => ObjectUtil.transformObjectKeys(x, { defaultTransform: ObjectUtil.camel })),
            includes: ObjectUtil.mapIncludesToLocalObject(json.Includes, conventions)
        };
    }
}
