import { throwError } from "../../Exceptions/index.js";
import { BatchOptions } from "./Batches/BatchOptions.js";
import { InMemoryDocumentSessionOperations } from "../Session/InMemoryDocumentSessionOperations.js";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";
import { DocumentInfo } from "../Session/DocumentInfo.js";
import { ForceRevisionStrategy } from "../Session/ForceRevisionStrategy.js";
import { SessionBeforeDeleteEventArgs } from "../Session/SessionEvents.js";

export type CommandType =
    "None"
    | "PUT"
    | "PATCH"
    | "DELETE"
    | "AttachmentPUT"
    | "AttachmentDELETE"
    | "AttachmentMOVE"
    | "AttachmentCOPY"
    | "CompareExchangePUT"
    | "CompareExchangeDELETE"
    | "Counters"
    | "ClientAnyCommand"
    | "ClientModifyDocumentCommand"
    | "BatchPATCH"
    | "ForceRevisionCreation"
    | "TimeSeries"
    | "TimeSeriesWithIncrements"
    | "TimeSeriesBulkInsert"
    | "TimeSeriesCopy"
    | "JsonPatch"
    | "HeartBeat"
    ;

export interface ICommandData {
    id: string;
    name: string;
    changeVector: string;
    type: CommandType;

    serialize(conventions: DocumentConventions): object;

    onBeforeSaveChanges?: (session: InMemoryDocumentSessionOperations) => void;
}

export class DeleteCommandData implements ICommandData {

    public readonly id: string;
    public name: string;
    public readonly changeVector: string;
    public readonly originalChangeVector: string;
    public document: any;

    public get type(): CommandType {
        return "DELETE";
    }

    constructor(id: string, changeVector?: string, originalChangeVector?: string) {
        this.id = id;
        if (!id) {
            throwError("InvalidArgumentException", "Id cannot be null or undefined.");
        }

        this.changeVector = changeVector;
        this.originalChangeVector = originalChangeVector;
    }

    public serialize(conventions: DocumentConventions): object {
        const result: any = {
            Id: this.id,
            ChangeVector: this.changeVector,
            Type: "DELETE",
            Document: this.document
        };

        if (this.originalChangeVector) {
            result.OriginalChangeVector = this.originalChangeVector;
        }

        this._serializeExtraFields(result);

        return result;
    }

    onBeforeSaveChanges(session: InMemoryDocumentSessionOperations): void {
        session.emit("beforeDelete", new SessionBeforeDeleteEventArgs(session, this.id, null));
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    protected _serializeExtraFields(resultingObject: object) {}
}

export class PutCommandDataBase<T extends object> implements ICommandData {

    public get type(): CommandType {
        return "PUT";
    }

    public id: string;
    public name: string = null;
    public changeVector: string;
    public readonly originalChangeVector: string;
    public forceRevisionCreationStrategy: ForceRevisionStrategy;

    private readonly _document: T;

    constructor(id: string, changeVector: string, originalChangeVector: string, document: T, strategy: ForceRevisionStrategy = "None") {

        if (!document) {
            throwError("InvalidArgumentException", "Document cannot be null or undefined.");
        }

        this.id = id;
        this.changeVector = changeVector;
        this.originalChangeVector = originalChangeVector;
        this._document = document;
        this.forceRevisionCreationStrategy = strategy;
    }

    public serialize(conventions: DocumentConventions): object {
        const result = {
            Id: this.id,
            ChangeVector: this.changeVector,
            OriginalChangeVector: this.originalChangeVector,
            Document: this._document,
            Type: "PUT"
        };

        if (this.forceRevisionCreationStrategy !== "None") {
            result["ForceRevisionCreationStrategy"] = this.forceRevisionCreationStrategy;
        }

        return result;
    }
}

export class PutCommandDataWithJson extends PutCommandDataBase<object> {

    public constructor(id: string, changeVector: string, originalChangeVector: string, document: object, strategy: ForceRevisionStrategy) {
        super(id, changeVector, originalChangeVector, document, strategy);
    }
}

export class SaveChangesData {
    public deferredCommands: ICommandData[];
    public deferredCommandsMap: Map<string, ICommandData>;
    public sessionCommands: ICommandData[] = [];
    public entities: object[] = [];
    public options: BatchOptions;
    public onSuccess: ActionsToRunOnSuccess;

    public constructor(args: {
        deferredCommands: ICommandData[],
        deferredCommandsMap: Map<string, ICommandData>,
        options: BatchOptions,
        session: InMemoryDocumentSessionOperations
    }) {
        this.deferredCommands = args.deferredCommands;
        this.deferredCommandsMap = args.deferredCommandsMap;
        this.options = args.options;
        this.onSuccess = new ActionsToRunOnSuccess(args.session);
    }
}

export class ActionsToRunOnSuccess {

    private readonly _session: InMemoryDocumentSessionOperations;
    private readonly _documentsByIdToRemove: string[] = [];
    private readonly _documentsByEntityToRemove: object[] = [];
    private readonly _documentInfosToUpdate: [DocumentInfo, object][] = [];

    private _clearDeletedEntities: boolean;

    public constructor(session: InMemoryDocumentSessionOperations) {
        this._session = session;
    }

    public removeDocumentById(id: string) {
        this._documentsByIdToRemove.push(id);
    }

    public removeDocumentByEntity(entity: object) {
        this._documentsByEntityToRemove.push(entity);
    }

    public updateEntityDocumentInfo(documentInfo: DocumentInfo, document: object) {
        this._documentInfosToUpdate.push([documentInfo, document]);
    }

    public clearSessionStateAfterSuccessfulSaveChanges() {
        for (const id of this._documentsByIdToRemove) {
            this._session.documentsById.remove(id);
        }

        for (const entity of this._documentsByEntityToRemove) {
            this._session.documentsByEntity.remove(entity);
        }

        for (const [info, document] of this._documentInfosToUpdate) {
            info.newDocument = false;
            info.document = document;
        }

        if (this._clearDeletedEntities) {
            this._session.deletedEntities.clear();
        }

        this._session.deferredCommands.length = 0;
        this._session.deferredCommandsMap.clear();
    }

    public clearDeletedEntities() {
        this._clearDeletedEntities = true;
    }
}
