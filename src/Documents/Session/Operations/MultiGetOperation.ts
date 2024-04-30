import { InMemoryDocumentSessionOperations } from "../InMemoryDocumentSessionOperations.js";
import { GetRequest } from "../../Commands/MultiGet/GetRequest.js";
import { MultiGetCommand } from "../../Commands/MultiGet/MultiGetCommand.js";

export class MultiGetOperation {
    private readonly _session: InMemoryDocumentSessionOperations;

    public constructor(session: InMemoryDocumentSessionOperations) {
        this._session = session;
    }

    public createRequest(requests: GetRequest[]): MultiGetCommand {
        return new MultiGetCommand(
            this._session.requestExecutor, this._session.conventions, requests, this._session.sessionInfo);
    }

    public setResult(result: object): void {
        // empty
    }
}
