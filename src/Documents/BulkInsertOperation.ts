import { GenerateEntityIdOnTheClient } from "./Identity/GenerateEntityIdOnTheClient";
import * as stream from "readable-stream";
import { RavenCommand } from "../Http/RavenCommand";
import { HttpRequestParameters } from "../Primitives/Http";
import { IMetadataDictionary } from "./Session/IMetadataDictionary";
import { createMetadataDictionary } from "../Mapping/MetadataAsDictionary";
import { CONSTANTS, HEADERS } from "../Constants";
import { getError, throwError } from "../Exceptions";
import { GetOperationStateCommand } from "./Operations/GetOperationStateOperation";
import { StringUtil } from "../Utility/StringUtil";
import { JsonSerializer } from "../Mapping/Json/Serializer";
import { RequestExecutor } from "../Http/RequestExecutor";
import { IDocumentStore } from "./IDocumentStore";
import { GetNextOperationIdCommand } from "./Commands/GetNextOperationIdCommand";
import { DocumentInfo } from "./Session/DocumentInfo";
import { EntityToJson } from "./Session/EntityToJson";
import { KillOperationCommand } from "./Commands/KillOperationCommand";
import { DocumentConventions } from "./Conventions/DocumentConventions";
import { ServerNode } from "../Http/ServerNode";
import { MetadataObject } from "./Session/MetadataObject";
import { CommandType } from "./Commands/CommandData";
import { TypeUtil } from "../Utility/TypeUtil";
import { IDisposable } from "../Types/Contracts";
import { TypedTimeSeriesEntry } from "./Session/TimeSeries/TypedTimeSeriesEntry";
import { ClassConstructor, EntityConstructor } from "../Types";
import { TimeSeriesOperations } from "./TimeSeries/TimeSeriesOperations";
import { TimeSeriesValuesHelper } from "./Session/TimeSeries/TimeSeriesValuesHelper";
import { Timer } from "../Primitives/Timer";
import { EventEmitter } from "node:events";
import { BulkInsertOnProgressEventArgs } from "./Session/SessionEvents";
import * as semaphore from "semaphore";
import { acquireSemaphore } from "../Utility/SemaphoreUtil";
import { Buffer } from "node:buffer";

class BulkInsertStream {

    private readonly _items: Array<string | Buffer> = [];
    private totalLength = 0;

    public push(data: string | Buffer) {
        this._items.push(data);
        this.totalLength += Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
    }

    public toBuffer(): Buffer {
        const result = Buffer.allocUnsafe(this.totalLength);
        let idx = 0;
        for (const inputElement of this._items) {
            if (Buffer.isBuffer(inputElement)) {
                inputElement.copy(result, idx);
                idx += inputElement.length;
            } else {
                result.write(inputElement, idx);
                idx += Buffer.byteLength(inputElement);
            }
        }

        return result;
    }

    public get length() {
        return this.totalLength;
    }
}

class RequestBodyStream extends stream.Readable {
    constructor() {
        super({
            highWaterMark: 1024 * 1024
        });
    }

    private _pending: Promise<void>;
    private _resume: () => void;

    _read(size: number) {
       this._resume?.();
    }

    write(data: Buffer | string) {
        const canConsumeMore = this.push(data);
        if (!canConsumeMore) {
            this._pending = new Promise(resolve => {
                this._resume = () => {
                    this._resume = null;
                    resolve();
                };
            });
        }
    }

    async flush(): Promise<void> {
        await this._pending;
    }
}

export class BulkInsertOperation {
    private _emitter = new EventEmitter();

    private _options: BulkInsertOptions;
    private _database: string;
    private readonly _generateEntityIdOnTheClient: GenerateEntityIdOnTheClient;

    private readonly _requestExecutor: RequestExecutor;
    private _bulkInsertExecuteTask: Promise<any>;
    private _bulkInsertExecuteTaskErrored = false;

    private _stream: RequestBodyStream;

    private _first: boolean = true;
    private _inProgressCommand: CommandType;
    private readonly _countersOperation = new BulkInsertOperation._countersBulkInsertOperationClass(this);
    private readonly _attachmentsOperation = new BulkInsertOperation._attachmentsBulkInsertOperationClass(this);
    private _operationId = -1;
    private _nodeTag: string;

    private readonly _timeSeriesBatchSize: number;

    private _concurrentCheck: number = 0;
    private _isInitialWrite: boolean = true;

    private _useCompression: boolean = false;

    private _unsubscribeChanges: IDisposable;
    private _onProgressInitialized = false;

    private _timer: Timer;
    private _lastWriteToStream: Date;
    private readonly _streamLock: semaphore.Semaphore;
    private _heartbeatCheckInterval = 40_000;

    //TODO:  private GZipStream _compressedStream;
    private _requestBodyStream: RequestBodyStream; //TODO: raw reableable or wrapped with compressed
    private _requestBodyStreamFinished: boolean = false;
    private _currentWriter: BulkInsertStream;
    private _backgroundWriter: BulkInsertStream;
    private _asyncWrite: Promise<void> = Promise.resolve();
    private _asyncWriteDone: boolean = true;
    private static readonly _maxSizeInBuffer = 1024 * 1024;

    public constructor(database: string, store: IDocumentStore, options?: BulkInsertOptions) {
        this._useCompression = options ? options.useCompression : false;
        this._options = options ?? {};
        this._database = database;
        this._conventions = store.conventions;
        this._store = store;
        if (StringUtil.isNullOrEmpty(database)) {
            this._throwNoDatabase();
        }
        this._requestExecutor = store.getRequestExecutor(database);
        this._currentWriter = new BulkInsertStream();
        this._backgroundWriter = new BulkInsertStream();
        this._timeSeriesBatchSize = this._conventions.bulkInsert.timeSeriesBatchSize;

        this._generateEntityIdOnTheClient = new GenerateEntityIdOnTheClient(this._requestExecutor.conventions,
            entity => this._requestExecutor.conventions.generateDocumentId(database, entity));

        this._streamLock = semaphore(1);
        this._lastWriteToStream = new Date();

        const timerState: TimerState = {
            parent: this,
            timer: null
        };

        this._timer = new Timer(() => BulkInsertOperation._handleHeartbeat(timerState), this._heartbeatCheckInterval, this._heartbeatCheckInterval);
        timerState.timer = this._timer;
    }

    private static async _handleHeartbeat(timerState: TimerState): Promise<void> {
        const bulkInsert = timerState.parent;
        if (!bulkInsert) {
            timerState.timer.dispose();
            return;
        }

        await bulkInsert.sendHeartBeat();
    }

    private async sendHeartBeat(): Promise<void> {
        if (!this.isHeartbeatIntervalExceeded()) {
            return;
        }

        const context = acquireSemaphore(this._streamLock, {
            timeout: 0
        });
        try {
            await context.promise;
        } catch {
            return ; // if locked we are already writing
        }

        try {
            await this._executeBeforeStore();
            this._endPreviousCommandIfNeeded();
            if (!BulkInsertOperation._checkServerVersion(this._requestExecutor.lastServerVersion)) {
                return;
            }

            if (!this._first) {
                this._writeComma();
            }

            this._first = false;
            this._inProgressCommand = "None";
            this._currentWriter.push("{\"Type\":\"HeartBeat\"}");

            await this.flushIfNeeded(true);
        } catch {
            //Ignore the heartbeat if failed
        } finally {
            context.dispose();
        }
    }

    private static _checkServerVersion(serverVersion: string): boolean {
        if (serverVersion) {
            const versionParsed = serverVersion.split(".");
            const major = Number.parseInt(versionParsed[0], 10);
            const minor = versionParsed.length > 1 ? Number.parseInt(versionParsed[1]) : 0;
            const build = versionParsed.length> 2 ? Number.parseInt(versionParsed[2]) : 0;
            if (Number.isNaN(major) || Number.isNaN(minor)) {
                return false;
            }

            return major > 5 || (major == 5 && minor >= 4 && build >= 110);
        }

        return false;
    }

    public on(event: "progress", handler: (value: BulkInsertOnProgressEventArgs) => void): this {
        this._emitter.on("progress", handler);
        this._onProgressInitialized = true;
        return this;
    }

    public off(event: "progress", handler: (value: BulkInsertOnProgressEventArgs) => void): this {
        this._emitter.off("progress", handler);
        return this;
    }

    get useCompression(): boolean {
        return this._useCompression;
    }

    set useCompression(value: boolean) {
        this._useCompression = value;
    }

    private async _throwBulkInsertAborted(e: Error, flushEx: Error = null) {
        let errorFromServer: Error;
        try {
            errorFromServer = await this._getExceptionFromOperation();
        } catch {
            // server is probably down, will propagate the original exception
        }
        //TODO: use flushEx variable

        if (errorFromServer) {
            throw errorFromServer;
        }

        throwError("BulkInsertAbortedException", "Failed to execute bulk insert", e);
    }

    private _throwNoDatabase(): void {
        throwError("BulkInsertInvalidOperationException", "Cannot start bulk insert operation without specifying a name of a database to operate on."
            + "Database name can be passed as an argument when bulk insert is being created or default database can be defined using 'DocumentStore.setDatabase' method.");
    }

    private async _waitForId(): Promise<void> {
        if (this._operationId !== -1) {
            return;
        }

        const bulkInsertGetIdRequest = new GetNextOperationIdCommand();
        await this._requestExecutor.execute(bulkInsertGetIdRequest);
        this._operationId = bulkInsertGetIdRequest.result;
        this._nodeTag = bulkInsertGetIdRequest.nodeTag;

        if (this._onProgressInitialized && !this._unsubscribeChanges) {
            const observable = this._store.changes(this._database, this._nodeTag)
                .forOperationId(this._operationId);

            const handler = value => {
                const state = value.state;
                if (state && state.status === "InProgress") {
                    this._emitter.emit("progress", new BulkInsertOnProgressEventArgs(state.progress));
                }
            }

            observable.on("data", handler);

            this._unsubscribeChanges = {
                dispose(): void {
                    observable.off("data", handler)
                }
            };
        }
    }

    private static _typeCheckStoreArgs(
        idOrMetadata?: string | IMetadataDictionary,
        optionalMetadata?: IMetadataDictionary): { id: string, getId: boolean, metadata: IMetadataDictionary } {

        let id: string;
        let metadata;
        let getId = false;

        if (typeof idOrMetadata === "string" || optionalMetadata) {
            id = idOrMetadata as string;
            metadata = optionalMetadata;
        } else {
            metadata = idOrMetadata;
            if (metadata && (CONSTANTS.Documents.Metadata.ID in metadata)) {
                id = metadata[CONSTANTS.Documents.Metadata.ID];
            }
        }

        if (!id) {
            getId = true;
        }

        return { id, metadata, getId };
    }

    public async store(entity: object): Promise<void>;
    public async store(entity: object, id: string): Promise<void>;
    public async store(entity: object, metadata: IMetadataDictionary): Promise<void>;
    public async store(entity: object, id: string, metadata: IMetadataDictionary): Promise<void>;
    public async store(
        entity: object,
        idOrMetadata?: string | IMetadataDictionary,
        optionalMetadata?: IMetadataDictionary): Promise<void> {

        const check = await this._concurrencyCheck();
        try {

            const opts = BulkInsertOperation._typeCheckStoreArgs(idOrMetadata, optionalMetadata);
            let metadata = opts.metadata;

            const id = opts.getId ? await this._getId(entity) : opts.id;
            BulkInsertOperation._verifyValidId(id);

            await this._executeBeforeStore();

            if (!metadata) {
                metadata = createMetadataDictionary({
                    raw: {}
                });
            }

            if (!(("@collection" as keyof MetadataObject) in metadata)) {
                const collection = this._requestExecutor.conventions.getCollectionNameForEntity(entity);
                if (collection) {
                    metadata["@collection"] = collection;
                }
            }

            if (!("Raven-Node-Type" as keyof MetadataObject in metadata)) {
                const descriptor = this._conventions.getTypeDescriptorByEntity(entity);
                const jsType = this._requestExecutor.conventions.getJsTypeName(descriptor);
                if (jsType) {
                    metadata["Raven-Node-Type"] = jsType;
                }
            }

            this._endPreviousCommandIfNeeded();

            await this._writeToStream(entity, id, metadata, "PUT");
        } finally {
            check.dispose();
        }
    }

    private async _writeToStream(entity: object, id: string, metadata: IMetadataDictionary, type: CommandType) {
        try {
            if (this._first) {
                this._first = false;
            } else {
                this._writeComma();
            }

            this._inProgressCommand = "None";

            const documentInfo = new DocumentInfo();
            documentInfo.metadataInstance = metadata;
            let json = EntityToJson.convertEntityToJson(entity, this._conventions, documentInfo, true);

            if (this._conventions.remoteEntityFieldNameConvention) {
                json = this._conventions.transformObjectKeysToRemoteFieldNameConvention(json);
            }

            this._currentWriter.push(`{"Id":"`);
            this._writeString(id);
            const jsonString = JsonSerializer.getDefault().serialize(json);
            this._currentWriter.push(`","Type":"PUT","Document":${jsonString}}`);
            await this.flushIfNeeded();
        } catch (e) {
            this._handleErrors(id, e);
        }
    }

    private _handleErrors(documentId: string, e: Error) {
        if (e.name === "BulkInsertClientException") {
            throw e;
        }
        const error = this._getExceptionFromOperation();
        if (error) {
            throw error;
        }

        throwError("InvalidOperationException", "Bulk insert error, Document Id: " + documentId, e);
    }

    private async _concurrencyCheck(): Promise<IDisposable> {
        if (this._concurrentCheck) {
            throwError("BulkInsertInvalidOperationException", "Bulk Insert store methods cannot be executed concurrently.");
        }
        this._concurrentCheck = 1;

        const context = acquireSemaphore(this._streamLock);
        await context.promise;

        return {
            dispose: () => {
                context.dispose();
                this._concurrentCheck = 0;
            }
        }
    }

    private async flushIfNeeded(force = false): Promise<void> {
        if (this._currentWriter.length > BulkInsertOperation._maxSizeInBuffer || this._asyncWriteDone) {
            await this._asyncWrite;

            const tmp = this._currentWriter;
            this._currentWriter = this._backgroundWriter;
            this._backgroundWriter = tmp;

            this._currentWriter = new BulkInsertStream();

            const buffer = this._backgroundWriter.toBuffer();
            force = true; // original version: force || this.isHeartbeatIntervalExceeded() || ; in node.js we need to force flush to use backpressure in steams
            this._asyncWriteDone = false;
            this._asyncWrite = this.writeToRequestBodyStream(buffer, force);
        }
    }

    private isHeartbeatIntervalExceeded(): boolean {
        return Date.now() - this._lastWriteToStream.getTime() >= this._heartbeatCheckInterval;
    }

    private async writeToRequestBodyStream(buffer: Buffer, force = false): Promise<void> {
        try {
            this._requestBodyStream.write(buffer);
            if (this._isInitialWrite || force) {
                this._isInitialWrite = false;

                await this._requestBodyStream.flush();
                this._lastWriteToStream = new Date();
            }
        } finally {
            this._asyncWriteDone = true;
        }
    }

    private _endPreviousCommandIfNeeded() {
        if (this._inProgressCommand === "Counters") {
            this._countersOperation.endPreviousCommandIfNeeded();
        } else if (this._inProgressCommand === "TimeSeries") {
            BulkInsertOperation.throwAlreadyRunningTimeSeries();
        }
    }

    private _writeString(input: string): void {
        for (let i = 0; i < input.length; i++) {
            const c = input[i];
            if (`"` === c) {
                if (i === 0 || input[i - 1] !== `\\`) {
                    this._currentWriter.push("\\");
                }
            }

            this._currentWriter.push(c);
        }
    }

    private _writeComma() {
        this._currentWriter.push(",");
    }

    private async _executeBeforeStore() {
        if (!this._requestBodyStream) {
            await this._waitForId();
            await this._ensureStream();
        }

        if (this._bulkInsertExecuteTaskErrored) {
            try {
                await this._bulkInsertExecuteTask;
            } catch (error) {
                await this._throwBulkInsertAborted(error);
            }
        }
    }

    private static _verifyValidId(id: string): void {
        if (StringUtil.isNullOrEmpty(id)) {
            throwError("BulkInsertInvalidOperationException", "Document id must have a non empty value." +
                "If you want to store object literals with empty id, please register convention here: store.conventions.findCollectionNameForObjectLiteral");
        }

        if (id.endsWith("|")) {
            throwError("NotSupportedException", "Document ids cannot end with '|', but was called with " + id);
        }
    }

    private async _getExceptionFromOperation(): Promise<Error> {
        const stateRequest = new GetOperationStateCommand(this._operationId, this._nodeTag);
        await this._requestExecutor.execute(stateRequest);
        if (!stateRequest.result) {
            return null;
        }

        const result = stateRequest.result["result"];

        if (stateRequest.result["status"] !== "Faulted") {
            return null;
        }

        return getError("BulkInsertAbortedException", result.error);
    }

    private async _ensureStream() {
        //TODO: sync with c#
        //TODO if (CompressionLevel != CompressionLevel.NoCompression)
        //                 _streamExposerContent.Headers.ContentEncoding.Add("gzip");

        try {
            this._requestBodyStream = new RequestBodyStream();
            this._stream = this._requestBodyStream; //TODO:
            const bulkCommand =
                new BulkInsertCommand(this._operationId, this._requestBodyStream, this._nodeTag, this._options.skipOverwriteIfUnchanged);
            bulkCommand.useCompression = this._useCompression;

            this._bulkInsertExecuteTask = this._requestExecutor.execute(bulkCommand);

            this._currentWriter.push("[");

            /* TODO
              if (CompressionLevel != CompressionLevel.NoCompression)
            {
                _compressedStream = new GZipStream(_stream, CompressionLevel, leaveOpen: true);
                _requestBodyStream = _compressedStream;
            }
             */

            this._bulkInsertExecuteTask
                .catch(() => this._bulkInsertExecuteTaskErrored = true);

        } catch (e) {
            throwError("RavenException", "Unable to open bulk insert stream.", e);
        }
    }

    public async abort(): Promise<void> {
        if (this._operationId !== -1) {
            await this._waitForId();

            try {
                await this._requestExecutor.execute(new KillOperationCommand(this._operationId, this._nodeTag));
            } catch (err) {
                throwError("BulkInsertAbortedException",
                    "Unable to kill bulk insert operation, because it was not found on the server.", err);
            }
        }
    }

    public async finish(): Promise<void> {
        if (this._requestBodyStreamFinished) {
            return;
        }

        this._timer?.dispose(); // in node.js we destroy timer in different place

        this._endPreviousCommandIfNeeded();

        let flushEx: Error;

        if (this._stream) {
            try {
                const context = acquireSemaphore(this._streamLock);
                await context.promise;

                try {
                    this._currentWriter.push("]");
                    await this._asyncWrite;
                    this._requestBodyStream.write(this._currentWriter.toBuffer());
                    //TODO: _compressedStream?.Dispose();
                    await this._stream.flush();
                } finally {
                    context.dispose();
                }
            } catch (e) {
                flushEx = e;
            }

            this._requestBodyStream.push(null);
            this._requestBodyStreamFinished = true;
        }

        if (this._operationId === -1) {
            // closing without calling a single store.
            return;
        }

        if (this._bulkInsertExecuteTask) {
            try {
                await this._bulkInsertExecuteTask;
            } catch (e) {
                await this._throwBulkInsertAborted(e, flushEx)
            }
        }

        if (this._unsubscribeChanges) {
            this._unsubscribeChanges.dispose();
        }
    }

    private readonly _conventions: DocumentConventions;
    private readonly _store: IDocumentStore;

    private async _getId(entity: any) {
        let idRef: string;
        if (this._generateEntityIdOnTheClient.tryGetIdFromInstance(entity, id => idRef = id)) {
            return idRef;
        }

        idRef = await this._generateEntityIdOnTheClient.generateDocumentKeyForStorage(entity);

        this._generateEntityIdOnTheClient.trySetIdentity(entity, idRef); // set id property if it was null;
        return idRef;
    }

    public attachmentsFor(id: string): IAttachmentsBulkInsert {
        if (StringUtil.isNullOrEmpty(id)) {
            throwError("InvalidArgumentException", "Document id cannot be null or empty");
        }

        return new BulkInsertOperation._attachmentsBulkInsertClass(this, id);
    }

    public timeSeriesFor(id: string, name): ITimeSeriesBulkInsert;
    public timeSeriesFor<T extends object>(clazz: EntityConstructor<T>, id: string): ITypedTimeSeriesBulkInsert<T>;
    public timeSeriesFor<T extends object>(clazz: EntityConstructor<T>, id: string, name: string): ITypedTimeSeriesBulkInsert<T>;
    public timeSeriesFor<T extends object>(classOrId: EntityConstructor<T> | string, idOrName: string, name?: string) {
        if (TypeUtil.isString(classOrId)) {
            return this._timeSeriesFor(classOrId, idOrName);
        } else {
            return this._typedTimeSeriesFor(classOrId, idOrName, name);
        }
    }

    private _typedTimeSeriesFor<T extends object>(clazz: EntityConstructor<T>, id: string, name: string = null) {
        if (StringUtil.isNullOrEmpty(id)) {
            throwError("InvalidArgumentException", "Document id cannot be null or empty");
        }

        let tsName = name;
        if (!tsName) {
            tsName = TimeSeriesOperations.getTimeSeriesName(clazz, this._conventions);
        }

        BulkInsertOperation._validateTimeSeriesName(tsName);

        return new BulkInsertOperation._typedTimeSeriesBulkInsertClass(this, clazz, id, tsName);

    }

    public countersFor(id: string): ICountersBulkInsert {
        if (StringUtil.isNullOrEmpty(id)) {
            throwError("InvalidArgumentException", "Document id cannot be null or empty");
        }

        return new BulkInsertOperation._countersBulkInsertClass(this, id);
    }

    private _timeSeriesFor(id: string, name: string): ITimeSeriesBulkInsert {
        if (StringUtil.isNullOrEmpty(id)) {
            throwError("InvalidArgumentException", "Document id cannot be null or empty");
        }

        BulkInsertOperation._validateTimeSeriesName(name);

        return new BulkInsertOperation._timeSeriesBulkInsertClass(this, id, name);
    }

    private static _validateTimeSeriesName(name: string) {
        if (StringUtil.isNullOrEmpty(name)) {
            throwError("InvalidArgumentException", "Time series name cannot be null or empty");
        }

        if (StringUtil.startsWithIgnoreCase(name, HEADERS.INCREMENTAL_TIME_SERIES_PREFIX) && !name.includes("@")) {
            throwError("InvalidArgumentException", "Time Series name cannot start with " + HEADERS.INCREMENTAL_TIME_SERIES_PREFIX + " prefix");
        }
    }

    static throwAlreadyRunningTimeSeries() {
        throwError("BulkInsertInvalidOperationException", "There is an already running time series operation, did you forget to close it?");
    }

    private static readonly _countersBulkInsertClass = class CountersBulkInsert implements ICountersBulkInsert {
        private readonly _operation: BulkInsertOperation;
        private readonly _id: string;

        public constructor(operation: BulkInsertOperation, id: string) {
            this._operation = operation;
            this._id = id;
        }

        public increment(name: string): Promise<void>;
        public increment(name: string, delta: number): Promise<void>;
        public increment(name: string, delta: number = 1): Promise<void> {
            return this._operation._countersOperation.increment(this._id, name, delta);
        }
    }

    private static _countersBulkInsertOperationClass = class CountersBulkInsertOperation {
        private readonly _operation: BulkInsertOperation;
        private _id: string;
        private _first: boolean = true;
        private static readonly MAX_COUNTERS_IN_BATCH = 1024;
        private _countersInBatch = 0;

        public constructor(bulkInsertOperation: BulkInsertOperation) {
            this._operation = bulkInsertOperation;
        }

        public async increment(id: string, name: string);
        public async increment(id: string, name: string, delta: number);
        public async increment(id: string, name: string, delta: number = 1) {
            const check = await this._operation._concurrencyCheck();

            try {

                await this._operation._executeBeforeStore();

                if (this._operation._inProgressCommand === "TimeSeries") {
                    BulkInsertOperation.throwAlreadyRunningTimeSeries();
                }

                try {
                    const isFirst = !this._id;

                    if (isFirst || !StringUtil.equalsIgnoreCase(this._id, id)) {
                        if (!isFirst) {
                            //we need to end the command for the previous document id
                            this._operation._currentWriter.push("]}},");
                        } else if (!this._operation._first) {
                            this._operation._writeComma();
                        }

                        this._operation._first = false;

                        this._id = id;
                        this._operation._inProgressCommand = "Counters";

                        this._writePrefixForNewCommand();
                    }

                    if (this._countersInBatch >= CountersBulkInsertOperation.MAX_COUNTERS_IN_BATCH) {
                        this._operation._currentWriter.push("]}},");

                        this._writePrefixForNewCommand();
                    }

                    this._countersInBatch++;

                    if (!this._first) {
                        this._operation._writeComma();
                    }

                    this._first = false;

                    this._operation._currentWriter.push(`{"Type":"Increment","CounterName":"`);
                    this._operation._writeString(name);
                    this._operation._currentWriter.push(`","Delta":`);
                    this._operation._currentWriter.push(delta.toString());
                    this._operation._currentWriter.push("}");

                    await this._operation.flushIfNeeded();

                } catch (e) {
                    this._operation._handleErrors(this._id, e);
                }
            } finally {
                check.dispose();
            }
        }

        public endPreviousCommandIfNeeded() {
            if (!this._id) {
                return;
            }

            this._operation._currentWriter.push("]}}");
            this._id = null;
        }

        private _writePrefixForNewCommand() {
            this._first = true;
            this._countersInBatch = 0;

            this._operation._currentWriter.push(`{"Id":"`);
            this._operation._writeString(this._id);
            this._operation._currentWriter.push(`","Type":"Counters","Counters":{"DocumentId":"`);
            this._operation._writeString(this._id);
            this._operation._currentWriter.push(`","Operations":[`);
        }
    }

    private static _timeSeriesBulkInsertBaseClass = class TimeSeriesBulkInsertBase implements IDisposable {
        private readonly _operation: BulkInsertOperation;
        private readonly _id: string;
        private readonly _name: string;
        private _first: boolean = true;
        private _timeSeriesInBatch: number = 0;

        protected constructor(operation: BulkInsertOperation, id: string, name: string) {
            operation._endPreviousCommandIfNeeded();

            this._operation = operation;
            this._id = id;
            this._name = name;

            this._operation._inProgressCommand = "TimeSeries";
        }

        protected async _appendInternal(timestamp: Date, values: number[], tag: string): Promise<void> {
            const check = await this._operation._concurrencyCheck();
            try {
                this._operation._lastWriteToStream = new Date();

                await this._operation._executeBeforeStore();

                try {
                    if (this._first) {
                        if (!this._operation._first) {
                            this._operation._writeComma();
                        }

                        this._writePrefixForNewCommand();
                    } else if (this._timeSeriesInBatch >= this._operation._timeSeriesBatchSize) {
                        this._operation._currentWriter.push("]}},");
                        this._writePrefixForNewCommand();
                    }

                    this._timeSeriesInBatch++;

                    if (!this._first) {
                        this._operation._writeComma();
                    }

                    this._first = false;

                    this._operation._currentWriter.push("[");
                    this._operation._currentWriter.push(timestamp.getTime().toString());
                    this._operation._writeComma();

                    this._operation._currentWriter.push(values.length.toString());
                    this._operation._writeComma();

                    let firstValue = true;

                    for (const value of values) {
                        if (!firstValue) {
                            this._operation._writeComma();
                        }

                        firstValue = false;
                        this._operation._currentWriter.push(((value ?? 0).toString()));
                    }

                    if (tag) {
                        this._operation._currentWriter.push(`,"`);
                        this._operation._writeString(tag);
                        this._operation._currentWriter.push(`"`);
                    }

                    this._operation._currentWriter.push("]");

                    await this._operation.flushIfNeeded();
                } catch (e) {
                    this._operation._handleErrors(this._id, e);
                }
            } finally {
                check.dispose();
            }
        }

        private _writePrefixForNewCommand() {
            this._first = true;
            this._timeSeriesInBatch = 0;

            this._operation._currentWriter.push(`{"Id":"`);
            this._operation._writeString(this._id);
            this._operation._currentWriter.push(`","Type":"TimeSeriesBulkInsert","TimeSeries":{"Name":"`);
            this._operation._writeString(this._name);
            this._operation._currentWriter.push(`","TimeFormat":"UnixTimeInMs","Appends":[`);
        }

        dispose(): void {
            this._operation._inProgressCommand = "None";

            if (!this._first) {
                this._operation._currentWriter.push("]}}");
            }
        }
    }

    private static _timeSeriesBulkInsertClass = class TimeSeriesBulkInsert extends BulkInsertOperation._timeSeriesBulkInsertBaseClass implements ITimeSeriesBulkInsert {
        public constructor(operation: BulkInsertOperation, id: string, name: string) {
            super(operation, id, name);
        }

        public append(timestamp: Date, value: number): Promise<void>;
        public append(timestamp: Date, value: number, tag: string): Promise<void>;
        public append(timestamp: Date, values: number[]): Promise<void>;
        public append(timestamp: Date, values: number[], tag: string): Promise<void>;
        public append(timestamp: Date, valueOrValues: number | number[], tag?: string): Promise<void> {
            if (TypeUtil.isArray(valueOrValues)) {
                return this._appendInternal(timestamp, valueOrValues, tag);
            } else {
                return this._appendInternal(timestamp, [ valueOrValues ], tag);
            }
        }
    }

    private static _typedTimeSeriesBulkInsertClass = class TypedTimeSeriesBulkInsert<T extends object> extends BulkInsertOperation._timeSeriesBulkInsertBaseClass implements ITypedTimeSeriesBulkInsert<T> {

        private readonly clazz: ClassConstructor<T>;

        public constructor(operation: BulkInsertOperation, clazz: ClassConstructor<T>, id: string, name: string) {
            super(operation, id, name);

            this.clazz = clazz;
        }

        append(timestamp: Date, value: T): Promise<void>;
        append(timestamp: Date, value: T, tag: string): Promise<void>;
        append(entry: TypedTimeSeriesEntry<T>): Promise<void>;
        append(timestampOrEntry: Date | TypedTimeSeriesEntry<T>, value?: T, tag?: string): Promise<void> {
            if (timestampOrEntry instanceof TypedTimeSeriesEntry) {
                return this.append(timestampOrEntry.timestamp, timestampOrEntry.value, timestampOrEntry.tag);
            } else  {
                const values = TimeSeriesValuesHelper.getValues(this.clazz, value);
                return this._appendInternal(timestampOrEntry, values, tag);
            }
        }
    }

    private static _attachmentsBulkInsertClass = class AttachmentsBulkInsert implements IAttachmentsBulkInsert {
        private readonly _operation: BulkInsertOperation;
        private readonly _id: string;

        public constructor(operation: BulkInsertOperation, id: string) {
            this._operation = operation;
            this._id = id;
        }

        public store(name: string, bytes: Buffer): Promise<void>;
        public store(name: string, bytes: Buffer, contentType: string): Promise<void>;
        public store(name: string, bytes: Buffer, contentType?: string): Promise<void> {
            return this._operation._attachmentsOperation.store(this._id, name, bytes, contentType);
        }
    }

    private static _attachmentsBulkInsertOperationClass = class AttachmentsBulkInsertOperation {
        private readonly _operation: BulkInsertOperation;

        public constructor(operation: BulkInsertOperation) {
            this._operation = operation;
        }

        public async store(id: string, name: string, bytes: Buffer): Promise<void>;
        public async store(id: string, name: string, bytes: Buffer, contentType: string): Promise<void>;
        public async store(id: string, name: string, bytes: Buffer, contentType?: string): Promise<void> {
            const check = await this._operation._concurrencyCheck();

            try {
                this._operation._lastWriteToStream = new Date();
                this._operation._endPreviousCommandIfNeeded();

                await this._operation._executeBeforeStore();

                try {
                    if (!this._operation._first) {
                        this._operation._writeComma();
                    }

                    this._operation._currentWriter.push(`{"Id":"`);
                    this._operation._writeString(id);
                    this._operation._currentWriter.push(`","Type":"AttachmentPUT","Name":"`);
                    this._operation._writeString(name);

                    if (contentType) {
                        this._operation._currentWriter.push(`","ContentType":"`);
                        this._operation._writeString(contentType);
                    }

                    this._operation._currentWriter.push(`","ContentLength":`);
                    this._operation._currentWriter.push(bytes.length.toString());
                    this._operation._currentWriter.push("}");

                    await this._operation.flushIfNeeded();

                    this._operation._currentWriter.push(bytes); //TODO: do we want to stream here?

                    await this._operation.flushIfNeeded();
                } catch (e) {
                    this._operation._handleErrors(id, e);
                }
            } finally {
                check.dispose();
            }
        }
    }
}

export interface ICountersBulkInsert {
    increment(name: string): Promise<void>;
    increment(name: string, delta: number): Promise<void>;
}

export interface ITimeSeriesBulkInsert extends IDisposable {
    append(timestamp: Date, value: number): Promise<void>
    append(timestamp: Date, value: number, tag: string): Promise<void>;
    append(timestamp: Date, values: number[]): Promise<void>;
    append(timestamp: Date, values: number[], tag: string): Promise<void>;
}

export interface ITypedTimeSeriesBulkInsert<T extends object> extends IDisposable {
    append(timestamp: Date, value: T): Promise<void>;
    append(timestamp: Date, value: T, tag: string): Promise<void>;
    append(entry: TypedTimeSeriesEntry<T>): Promise<void>;
}

export interface IAttachmentsBulkInsert {
    store(name: string, bytes: Buffer): Promise<void>;
    store(name: string, bytes: Buffer, contentType: string): Promise<void>;
}

export class BulkInsertCommand extends RavenCommand<void> {
    public get isReadRequest() {
        return false;
    }

    private readonly _stream: stream.Readable;
    private _skipOverwriteIfUnchanged: boolean;
    private readonly _id: number;
    public useCompression: boolean;

    public constructor(id: number, stream: stream.Readable, nodeTag: string, skipOverwriteIfUnchanged: boolean) {
        super();

        this._stream = stream;
        this._id = id;
        this._selectedNodeTag = nodeTag;
        this._skipOverwriteIfUnchanged = skipOverwriteIfUnchanged;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        const uri = node.url
            + "/databases/" + node.database
            + "/bulk_insert?id=" + this._id
            + "&skipOverwriteIfUnchanged=" + (this._skipOverwriteIfUnchanged ? "true" : "false");

        const headers = this._headers().typeAppJson().build();
        // TODO: useCompression ? new GzipCompressingEntity(_stream) : _stream);
        return {
            method: "POST",
            uri,
            body: this._stream,
            headers
        };
    }

    public async setResponseAsync(bodyStream: stream.Stream, fromCache: boolean): Promise<string> {
        return throwError("NotImplementedException", "Not implemented");
    }
}

export interface BulkInsertOptions {
    useCompression?: boolean;
    skipOverwriteIfUnchanged?: boolean;
}

export interface TimerState {
    parent: BulkInsertOperation;
    timer: Timer;
}
