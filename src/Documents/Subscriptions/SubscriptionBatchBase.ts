import { DocumentType } from "../DocumentAbstractions.js";
import { getLogger } from "../../Utility/LogUtil.js";
import { throwError } from "../../Exceptions/index.js";
import { CONSTANTS } from "../../Constants.js";
import { StringUtil } from "../../Utility/StringUtil.js";
import { createMetadataDictionary } from "../../Mapping/MetadataAsDictionary.js";
import { RequestExecutor } from "../../Http/RequestExecutor.js";
import { BatchFromServer, CounterIncludeItem } from "./BatchFromServer.js";
import { IMetadataDictionary } from "../Session/IMetadataDictionary.js";
import { EntityToJson } from "../Session/EntityToJson.js";
import { EOL } from "../../Utility/OsUtil.js";

export abstract class SubscriptionBatchBase<T extends object> {

    private readonly _documentType: DocumentType;
    private readonly _revisions: boolean;

    public lastSentChangeVectorInBatch: string;

    protected readonly _requestExecutor: RequestExecutor;
    protected readonly _dbName: string;

    private readonly _logger = getLogger({ module: "SubscriptionBatch" });

    private readonly _items = [] as Item<T>[];

    protected _includes: object[];
    protected _counterIncludes: CounterIncludeItem[];
    protected _timeSeriesIncludes: any[];


    public get items() {
        return this._items;
    }

    protected abstract ensureDocumentId(item: T, id: string): void;


    public getNumberOfItemsInBatch() {
        return this._items ? this._items.length : 0;
    }

    public getNumberOfIncludes() {
        return this._includes ? this._includes.length : 0;
    }

    public constructor(documentType: DocumentType, revisions: boolean, requestExecutor: RequestExecutor, dbName: string) {
        this._documentType = documentType;
        this._revisions = revisions;
        this._requestExecutor = requestExecutor;
        this._dbName = dbName;
    }

    public initialize(batch: BatchFromServer): void {
        this._includes = batch.includes;
        this._counterIncludes = batch.counterIncludes;
        this._timeSeriesIncludes = batch.timeSeriesIncludes;
        this._items.length = 0;

        let lastReceivedChangeVector: string;

        for (const item of batch.messages) {
            const curDoc = item.data;
            const metadata = curDoc[CONSTANTS.Documents.Metadata.KEY];
            if (!metadata) {
                SubscriptionBatchBase._throwRequired("@metadata field");
            }
            const id = metadata[CONSTANTS.Documents.Metadata.ID];

            if (!id) {
                SubscriptionBatchBase._throwRequired("@id field");
            }

            const changeVector: string = metadata[CONSTANTS.Documents.Metadata.CHANGE_VECTOR];
            if (!changeVector) {
                SubscriptionBatchBase._throwRequired("@change-vector field");
            }

            lastReceivedChangeVector = changeVector;

            const projection = metadata[CONSTANTS.Documents.Metadata.PROJECTION] ?? false;

            this._logger.info("Got " + id + " (change vector: [" + lastReceivedChangeVector + "]");

            let instance: T = null;

            if (!item.exception) {
                instance = EntityToJson.convertToEntity(this._documentType, id, curDoc, this._requestExecutor.conventions);

                if (!StringUtil.isNullOrEmpty(id)) {
                    this.ensureDocumentId(instance, id);
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
