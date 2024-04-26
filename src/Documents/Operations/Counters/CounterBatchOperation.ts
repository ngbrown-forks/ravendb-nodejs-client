import { IOperation, OperationResultType } from "../OperationAbstractions.js";
import { CountersDetail } from "./CountersDetail.js";
import { CounterBatch } from "./CounterBatch.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { IDocumentStore } from "../../IDocumentStore.js";
import { HttpCache } from "../../../Http/HttpCache.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { throwError } from "../../../Exceptions/index.js";
import { ServerNode } from "../../../Http/ServerNode.js";
import { HttpRequestParameters } from "../../../Primitives/Http.js";
import { Stream } from "node:stream";

export class CounterBatchOperation implements IOperation<CountersDetail> {

    public get resultType(): OperationResultType {
        return "CommandResult";
    }

    private readonly _counterBatch: CounterBatch;

    public constructor(counterBatch: CounterBatch) {
        this._counterBatch = counterBatch;
    }

    public getCommand(
        store: IDocumentStore, conventions: DocumentConventions, cache: HttpCache): RavenCommand<CountersDetail> {
        return new CounterBatchCommand(this._counterBatch);
    }
}

export class CounterBatchCommand extends RavenCommand<CountersDetail> {
    private readonly _counterBatch: CounterBatch;

    public constructor(counterBatch: CounterBatch) {
        super();
        if (!counterBatch) {
            throwError("InvalidArgumentException", "CounterBatch cannot be null.");
        }

        this._counterBatch = counterBatch;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
    const uri = node.url + "/databases/" + node.database + "/counters";
    const body = JSON.stringify(this._counterBatch.serialize());
    return {
        method: "POST",
        uri,
        body,
        headers: this._headers().typeAppJson().build()
    };
}
    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            return;
        }

        return await this._parseResponseDefaultAsync(bodyStream);
    }

    public get isReadRequest(): boolean {
        return false;
    }
}
