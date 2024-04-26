import { ICommandData } from "../Commands/CommandData.js";
import { InMemoryDocumentSessionOperations } from "./InMemoryDocumentSessionOperations.js";
import { RequestExecutor } from "../../Http/RequestExecutor.js";
import { SessionInfo } from "./IDocumentSession.js";
import { IDocumentStore } from "../IDocumentStore.js";
import { DocumentsById } from "./DocumentsById.js";

export abstract class AdvancedSessionExtensionBase {
    protected _session: InMemoryDocumentSessionOperations;
    protected _requestExecutor: RequestExecutor;
    protected _sessionInfo: SessionInfo;
    protected _documentStore: IDocumentStore;

    // keys are produced with CommandIdTypeAndName.keyFor() method
    protected _deferredCommandsMap: Map<string, ICommandData>;
    protected _documentsById: DocumentsById;

    protected constructor(session: InMemoryDocumentSessionOperations) {
        this._session = session;
        this._requestExecutor = session.requestExecutor;
        this._sessionInfo = session.sessionInfo;
        this._documentStore = session.documentStore;
        this._deferredCommandsMap = session.deferredCommandsMap;
        this._documentsById = session.documentsById;
    }

    public defer(command: ICommandData, ...commands: ICommandData[]): void {
        this._session.defer(command, ...commands);
    }
}