import { QueryResult } from "../Queries/QueryResult.js";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";
import { Stream } from "node:stream";
import { QueryCommand } from "./QueryCommand.js";
import { RavenCommandResponsePipeline } from "../../Http/RavenCommandResponsePipeline.js";
import { ServerCasing, ServerResponse } from "../../Types/index.js";
import { ObjectUtil } from "../../Utility/ObjectUtil.js";
import { DateUtil } from "../../Utility/DateUtil.js";

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
            indexTimestamp: DateUtil.utc.parse(IndexTimestamp),
            lastQueryTime: DateUtil.utc.parse(LastQueryTime),
            results: Results.map(x => ObjectUtil.transformObjectKeys(x, { defaultTransform: ObjectUtil.camel })),
            includes: ObjectUtil.mapIncludesToLocalObject(json.Includes, conventions)
        };
    }
}
