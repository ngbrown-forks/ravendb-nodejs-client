import { HttpRequestParameters } from "../../Primitives/Http.js";
import { RavenCommand } from "../../Http/RavenCommand.js";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";
import { IndexQuery, writeIndexQuery } from "../Queries/IndexQuery.js";
import { throwError } from "../../Exceptions/index.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { Stream } from "node:stream";

export interface ExplainQueryResult {
    index: string;
    reason: string;
}

export class ExplainQueryCommand extends RavenCommand<ExplainQueryResult[]> {

    private readonly _conventions: DocumentConventions;
    private readonly _indexQuery: IndexQuery;

    public constructor(conventions: DocumentConventions, indexQuery: IndexQuery) {
        super();

        if (!conventions) {
            throwError("InvalidArgumentException", "Conventions cannot be null");
        }

        if (!indexQuery) {
            throwError("InvalidArgumentException", "IndexQuery cannot be null");
        }

        this._conventions = conventions;
        this._indexQuery = indexQuery;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url + "/databases/" + node.database + "/queries?debug=explain";

        const headers = this._headers().typeAppJson().build();
        return {
            method: "POST",
            uri,
            body: writeIndexQuery(this._conventions, this._indexQuery),
            headers
        };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this.result = null;
            return;
        }

        let body: string = null;

        const data = await this._defaultPipeline(_ => body = _)
            .process(bodyStream);

        const explainResults = data["results"] as ExplainQueryResult[];
        if (!explainResults) {
            this._throwInvalidResponse();
            return;
        }

        this.result = explainResults;
        return body;
    }

    public get isReadRequest(): boolean {
        return true;
    }
}
