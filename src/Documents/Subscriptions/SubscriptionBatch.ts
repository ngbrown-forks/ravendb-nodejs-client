import { DocumentType } from "../DocumentAbstractions.js";
import { getLogger } from "../../Utility/LogUtil.js";
import { GenerateEntityIdOnTheClient } from "../Identity/GenerateEntityIdOnTheClient.js";
import { throwError } from "../../Exceptions/index.js";
import { CONSTANTS } from "../../Constants.js";
import { StringUtil } from "../../Utility/StringUtil.js";
import { createMetadataDictionary } from "../../Mapping/MetadataAsDictionary.js";
import { RequestExecutor } from "../../Http/RequestExecutor.js";
import { IDocumentStore } from "../IDocumentStore.js";
import { IDocumentSession } from "../Session/IDocumentSession.js";
import { SessionOptions } from "../Session/SessionOptions.js";
import { InMemoryDocumentSessionOperations } from "../Session/InMemoryDocumentSessionOperations.js";
import { DocumentInfo } from "../Session/DocumentInfo.js";
import { BatchFromServer, CounterIncludeItem } from "./BatchFromServer.js";
import { IMetadataDictionary } from "../Session/IMetadataDictionary.js";
import { EntityToJson } from "../Session/EntityToJson.js";
import { EOL } from "../../Utility/OsUtil.js";

export class SubscriptionBatch<T extends object> {

    private readonly _documentType: DocumentType;
    private readonly _revisions: boolean;
    private readonly _requestExecutor: RequestExecutor;
    private readonly _store: IDocumentStore;
    private readonly _dbName: string;

    private readonly _logger = getLogger({ module: "SubscriptionBatch" });
    private readonly _generateEntityIdOnTheClient: GenerateEntityIdOnTheClient;
    private readonly _items = [] as Item<T>[];

    private _includes: object[];
    private _counterIncludes: CounterIncludeItem[];
    private _timeSeriesIncludes: any[];
    private _sessionOpened = false;

    public get items() {
        return this._items;
    }

    public openSession(): IDocumentSession;
    public openSession(options: SessionOptions): IDocumentSession;
    public openSession(options?: SessionOptions): IDocumentSession {
        if (options) {
            SubscriptionBatch._validateSessionOptions(options);
        }

        options = options || {} as SessionOptions;
        options.database = this._dbName;
        options.requestExecutor = this._requestExecutor;

        return this._openSessionInternal(options);
    }

    private _openSessionInternal(options: SessionOptions): IDocumentSession {
        if (this._sessionOpened) {
            this.throwSessionCanBeOpenedOnlyOnce();
        }
        this._sessionOpened = true;
        const s = this._store.openSession(options);
        this._loadDataToSession(s as any as InMemoryDocumentSessionOperations);
        return s;
    }

    private throwSessionCanBeOpenedOnlyOnce(): void {
        throwError("InvalidOperationException", "Session can only be opened once per each Subscription batch");
    }

    public getNumberOfItemsInBatch() {
        return this._items ? this._items.length : 0;
    }

    public getNumberOfIncludes() {
        return this._includes ? this._includes.length : 0;
    }

    public constructor(documentType: DocumentType, revisions: boolean, requestExecutor: RequestExecutor,
                       store: IDocumentStore, dbName: string) {
        this._documentType = documentType;
        this._revisions = revisions;
        this._requestExecutor = requestExecutor;
        this._store = store;
        this._dbName = dbName;

        this._generateEntityIdOnTheClient = new GenerateEntityIdOnTheClient(this._requestExecutor.conventions,
            () => throwError("InvalidOperationException", "Shouldn't be generating new ids here"));
    }

    private static _validateSessionOptions(options: SessionOptions): void {
        if (options.database) {
            throwError(
                "InvalidOperationException", "Cannot set Database when session is opened in subscription.");
        }

        if (options.requestExecutor) {
            throwError(
                "InvalidOperationException", "Cannot set RequestExecutor when session is opened in subscription.");
        }

        if (options.transactionMode !== "SingleNode") {
            throwError(
                "InvalidOperationException",
                "Cannot set TransactionMode when session is opened in subscription. Only 'SingleNode' is supported.");
        }
    }

    private _loadDataToSession(session: InMemoryDocumentSessionOperations): void {
        if (session.noTracking) {
            return;
        }

        if (this._includes && this._includes.length) {
            for (const item of this._includes) {
                session.registerIncludes(item);
            }
        }

        if (this._counterIncludes && this._counterIncludes.length) {
            for (const item of this._counterIncludes) {
                session.registerCounters(item.includes, item.counterIncludes);
            }
        }

        if (this._timeSeriesIncludes && this._timeSeriesIncludes.length > 0) {
            for (const item of this._timeSeriesIncludes) {
                session.registerTimeSeries(item);
            }
        }

        for (const item of this._items) {
            if (item.projection || item.revision) {
                continue;
            }
            const documentInfo = new DocumentInfo();
            documentInfo.id = item.id;
            documentInfo.document = item.rawResult;
            documentInfo.metadata = item.rawMetadata;
            documentInfo.metadataInstance = item.metadata;
            documentInfo.changeVector = item.changeVector;
            documentInfo.entity = item.result;
            documentInfo.newDocument = false;
            session.registerExternalLoadedIntoTheSession(documentInfo);
        }
     }

    public initialize(batch: BatchFromServer): string {
        this._sessionOpened = false;
        this._includes = batch.includes;
        this._counterIncludes = batch.counterIncludes;
        this._timeSeriesIncludes = batch.timeSeriesIncludes;
        this._items.length = 0;

        let lastReceivedChangeVector: string;

        for (const item of batch.messages) {
            const curDoc = item.data;
            const metadata = curDoc[CONSTANTS.Documents.Metadata.KEY];
            if (!metadata) {
                SubscriptionBatch._throwRequired("@metadata field");
            }
            const id = metadata[CONSTANTS.Documents.Metadata.ID];

            if (!id) {
                SubscriptionBatch._throwRequired("@id field");
            }

            const changeVector: string = metadata[CONSTANTS.Documents.Metadata.CHANGE_VECTOR];
            if (!changeVector) {
                SubscriptionBatch._throwRequired("@change-vector field");
            }

            lastReceivedChangeVector = changeVector;

            const projection = metadata[CONSTANTS.Documents.Metadata.PROJECTION] ?? false;

            this._logger.info("Got " + id + " (change vector: [" + lastReceivedChangeVector + "]");

            let instance: T = null;

            if (!item.exception) {
                instance = EntityToJson.convertToEntity(this._documentType, id, curDoc, this._requestExecutor.conventions);

                if (!StringUtil.isNullOrEmpty(id)) {
                    this._generateEntityIdOnTheClient.trySetIdentity(instance, id);
                }

                // TODO: check if something's missing here
                // https://github.com/ravendb/ravendb-jvm-client/blob/v4.1/src/main/java/net/ravendb/client/documents/subscriptions/SubscriptionBatch.java#L222
            }

            const itemToAdd = new Item<T>();
            itemToAdd.changeVector = changeVector;
            itemToAdd.id = id;
            itemToAdd.rawResult = curDoc;
            itemToAdd.rawMetadata = metadata;
            itemToAdd.result = instance;
            itemToAdd.exceptionMessage = item.exception;
            itemToAdd.projection = projection;
            itemToAdd.revision = this._revisions;
            itemToAdd.metadata = createMetadataDictionary({ raw: metadata });

            this._items.push(itemToAdd);
        }

        return lastReceivedChangeVector;
    }

    private static _throwRequired(name: string) {
        throwError("InvalidOperationException", "Document must have a " + name);
    }
}

/**
 * Represents a single item in a subscription batch results.
 */
export class Item<T> {

    private _result: T;
    public exceptionMessage: string;
    public id: string;
    public changeVector: string;
    public projection: boolean;
    public revision: boolean;
    public metadata: IMetadataDictionary;

    private _throwItemProcessError() {
        throwError("InvalidOperationException",
            "Failed to process document " + this.id + " with Change Vector "
            + this.changeVector + " because: " + EOL + this.exceptionMessage);
    }

    public get result() {
        if (this.exceptionMessage) {
            this._throwItemProcessError();
        }

        return this._result;
    }

    public set result(result: T) {
        this._result = result;
    }

    public rawResult: any;
    public rawMetadata: any;
}
