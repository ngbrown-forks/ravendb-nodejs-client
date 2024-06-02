import { GenerateEntityIdOnTheClient } from "./Identity/GenerateEntityIdOnTheClient.js";
import { Readable, PassThrough, Stream } from "node:stream";
import { RavenCommand } from "../Http/RavenCommand.js";
import { HttpRequestParameters } from "../Primitives/Http.js";
import { IMetadataDictionary } from "./Session/IMetadataDictionary.js";
import { createMetadataDictionary } from "../Mapping/MetadataAsDictionary.js";
import { CONSTANTS, HEADERS } from "../Constants.js";
import { getError, throwError } from "../Exceptions/index.js";
import { GetOperationStateCommand } from "./Operations/GetOperationStateOperation.js";
import { StringUtil } from "../Utility/StringUtil.js";
import { pipelineAsync } from "../Utility/StreamUtil.js";
import { JsonSerializer } from "../Mapping/Json/Serializer.js";
import { RequestExecutor } from "../Http/RequestExecutor.js";
import { IDocumentStore } from "./IDocumentStore.js";
import { GetNextOperationIdCommand } from "./Commands/GetNextOperationIdCommand.js";
import { DocumentInfo } from "./Session/DocumentInfo.js";
import { EntityToJson } from "./Session/EntityToJson.js";
import { KillOperationCommand } from "./Commands/KillOperationCommand.js";
import { DocumentConventions } from "./Conventions/DocumentConventions.js";
import { ServerNode } from "../Http/ServerNode.js";
import { MetadataObject } from "./Session/MetadataObject.js";
import { CommandType } from "./Commands/CommandData.js";
import { TypeUtil } from "../Utility/TypeUtil.js";
import { IDisposable } from "../Types/Contracts.js";
import { TypedTimeSeriesEntry } from "./Session/TimeSeries/TypedTimeSeriesEntry.js";
import { ClassConstructor, EntityConstructor } from "../Types/index.js";
import { TimeSeriesOperations } from "./TimeSeries/TimeSeriesOperations.js";
import { TimeSeriesValuesHelper } from "./Session/TimeSeries/TimeSeriesValuesHelper.js";
import { Timer } from "../Primitives/Timer.js";
import { EventEmitter } from "node:events";
import { BulkInsertOnProgressEventArgs } from "./Session/SessionEvents.js";
import { BulkInsertOperationBase } from "./BulkInsert/BulkInsertOperationBase.js";

export class BulkInsertOperation extends BulkInsertOperationBase<object> {

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
            const check = this._operation._concurrencyCheck();

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
                            this._operation._writer.push("]}},");
                        } else if (!this._operation._first) {
                            this._operation._writeComma();
                        }

                        this._operation._first = false;

                        this._id = id;
                        this._operation._inProgressCommand = "Counters";

                        this._writePrefixForNewCommand();
                    }

                    if (this._countersInBatch >= CountersBulkInsertOperation.MAX_COUNTERS_IN_BATCH) {
                        this._operation._writer.push("]}},");

                        this._writePrefixForNewCommand();
                    }

                    this._countersInBatch++;

                    if (!this._first) {
                        this._operation._writeComma();
                    }

                    this._first = false;

                    this._operation._writer.push(`{"Type":"Increment","CounterName":"`);
                    this._operation._writeString(name);
                    this._operation._writer.push(`","Delta":`);
                    this._operation._writer.push(delta.toString());
                    this._operation._writer.push("}");

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

            this._operation._writer.push("]}}");
            this._id = null;
        }

        private _writePrefixForNewCommand() {
            this._first = true;
            this._countersInBatch = 0;

            this._operation._writer.push(`{"Id":"`);
            this._operation._writeString(this._id);
            this._operation._writer.push(`","Type":"Counters","Counters":{"DocumentId":"`);
            this._operation._writeString(this._id);
            this._operation._writer.push(`","Operations":[`);
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
            const check = this._operation._concurrencyCheck();

            try {
                this._operation._lastWriteToStream = new Date();
                this._operation._endPreviousCommandIfNeeded();

                await this._operation._executeBeforeStore();

                try {
                    if (!this._operation._first) {
                        this._operation._writeComma();
                    }

                    this._operation._writer.push(`{"Id":"`);
                    this._operation._writeString(id);
                    this._operation._writer.push(`","Type":"AttachmentPUT","Name":"`);
                    this._operation._writeString(name);

                    if (contentType) {
                        this._operation._writer.push(`","ContentType":"`);
                        this._operation._writeString(contentType);
                    }

                    this._operation._writer.push(`","ContentLength":`);
                    this._operation._writer.push(bytes.length.toString());
                    this._operation._writer.push("}");

                    this._operation._writer.push(bytes);
                } catch (e) {
                    this._operation._handleErrors(id, e);
                }
            } finally {
                check.dispose();
            }
        }
    }


    private _emitter = new EventEmitter();

    private _options: BulkInsertOptions;
    private _database: string;
    private readonly _generateEntityIdOnTheClient: GenerateEntityIdOnTheClient;

    private readonly _requestExecutor: RequestExecutor;


    private _first: boolean = true;
    private _inProgressCommand: CommandType;
    private readonly _countersOperation = new BulkInsertOperation._countersBulkInsertOperationClass(this);
    private readonly _attachmentsOperation = new BulkInsertOperation._attachmentsBulkInsertOperationClass(this);
    private _nodeTag: string;

    private _useCompression: boolean = false;
    private readonly _timeSeriesBatchSize: number;

    private _concurrentCheck: number = 0;
    private _isInitialWrite: boolean = true;
    private _abortReject: (error: Error) => void;

    private _requestBodyStream: PassThrough;
    private _pipelineFinished: Promise<void>;

    private _unsubscribeChanges: IDisposable;
    private _onProgressInitialized = false;
    private _timer: Timer;
    private _lastWriteToStream: Date;
    private _heartbeatCheckInterval = 40_000;

    public constructor(database: string, store: IDocumentStore, options?: BulkInsertOptions) {
        super();
        this._conventions = store.conventions;
        this._store = store;
        if (StringUtil.isNullOrEmpty(database)) {
            BulkInsertOperation._throwNoDatabase();
        }
        this._requestExecutor = store.getRequestExecutor(database);
        this._useCompression = options ? options.useCompression : false;

        this._options = options ?? {};
        this._database = database;

        this._timeSeriesBatchSize = this._conventions.bulkInsert.timeSeriesBatchSize;

        this._generateEntityIdOnTheClient = new GenerateEntityIdOnTheClient(this._requestExecutor.conventions,
            entity => this._requestExecutor.conventions.generateDocumentId(database, entity));
        this._bulkInsertAborted = new Promise((_, reject) => this._abortReject = reject);

        this._bulkInsertAborted.catch(err => {
            // we're awaiting it elsewhere
        });

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
        if (Date.now() - this._lastWriteToStream.getTime() < this._heartbeatCheckInterval) {
            return;
        }

        await this._executeBeforeStore();
        this._endPreviousCommandIfNeeded();
        if (!BulkInsertOperation._checkServerVersion(this._requestExecutor.lastServerVersion)) {
            return ;
        }

        if (!this._first) {
            this._writeComma();
        }

        this._first = false;
        this._inProgressCommand = "None";
        this._writer.push("{\"Type\":\"HeartBeat\"}");
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

            if (major === 6 && build < 2) {
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

    private static _throwNoDatabase(): void {
        throwError("BulkInsertInvalidOperationException", "Cannot start bulk insert operation without specifying a name of a database to operate on."
            + "Database name can be passed as an argument when bulk insert is being created or default database can be defined using 'DocumentStore.setDatabase' method.");
    }

    protected async _waitForId(): Promise<void> {
        if (this._operationId !== -1) {
            return;
        }

        const bulkInsertGetIdRequest = new GetNextOperationIdCommand();
        await this._requestExecutor.execute(bulkInsertGetIdRequest);
        this._operationId = bulkInsertGetIdRequest.result;
        this._nodeTag = bulkInsertGetIdRequest.nodeTag;

        if (this._onProgressInitialized && !this._unsubscribeChanges) {
            const observable = this._store.changes()
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

    public async store(entity: object);
    public async store(entity: object, id: string);
    public async store(entity: object, metadata: IMetadataDictionary);
    public async store(entity: object, id: string, metadata: IMetadataDictionary);
    public async store(
        entity: object,
        idOrMetadata?: string | IMetadataDictionary,
        optionalMetadata?: IMetadataDictionary) {

        const check = this._concurrencyCheck();
        try {

            const opts = BulkInsertOperation._typeCheckStoreArgs(idOrMetadata, optionalMetadata);
            let metadata = opts.metadata;

            const id = opts.getId ? await this._getId(entity) : opts.id;
            this._lastWriteToStream = new Date();
            BulkInsertOperation._verifyValidId(id);

            if (!this._writer) {
                await this._waitForId();
                await this._ensureStream();
            }

            if (this._completedWithError || this._aborted) {
                await this._checkIfBulkInsertWasAborted();
            }

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

            this._writeToStream(entity, id, metadata, "PUT");
        } finally {
            check.dispose();
        }
    }

    private _writeToStream(entity: object, id: string, metadata: IMetadataDictionary, type: CommandType) {
        if (this._first) {
            this._first = false;
        } else {
            this._writeComma();
        }

        this._inProgressCommand = "None";

        const documentInfo = new DocumentInfo();
        documentInfo.metadataInstance = metadata;
        let json = EntityToJson.convertEntityToJson(entity, this._conventions, documentInfo, true);

        json = this._conventions.transformObjectKeysToRemoteFieldNameConvention(json);

        this._writer.push(`{"Id":"`);
        this._writeString(id);
        const jsonString = JsonSerializer.getDefault().serialize(json);
        this._writer.push(`","Type":"PUT","Document":${jsonString}}`);

    }

    private _handleErrors(documentId: string, e: Error) {
        if (e.name === "BulkInsertClientException") {
            throw e;
        }
        const error = this._getExceptionFromOperation();
        if (error) {
            throw error;
        }

        throwError("InvalidOperationException", "Bulk insert error", e);
    }

    private _concurrencyCheck(): IDisposable {
        if (this._concurrentCheck) {
            throwError("BulkInsertInvalidOperationException", "Bulk Insert store methods cannot be executed concurrently.");
        }

        this._concurrentCheck = 1;

        return {
            dispose: () => this._concurrentCheck = 0
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
                    this._writer.push("\\");
                }
            }

            this._writer.push(c);
        }
    }

    private _writeComma() {
        this._writer.push(",");
    }

    private async _checkIfBulkInsertWasAborted() {
        if (this._completedWithError) {
            try {
                await this._bulkInsertExecuteTask;
            } catch (error) {
                await this._throwBulkInsertAborted(error);
            } finally {
                this._writer.emit("end");
            }
        }

        if (this._aborted) {
            try {
                await this._bulkInsertAborted;
            } finally {
                this._writer.emit("end");
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

    protected async _getExceptionFromOperation(): Promise<Error> {
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

    protected async _ensureStream() {
        try {
            this._writer = new PassThrough();

            this._requestBodyStream = new PassThrough();
            const bulkCommand =
                new BulkInsertCommand(this._operationId, this._requestBodyStream, this._nodeTag, this._options.skipOverwriteIfUnchanged);
            bulkCommand.useCompression = this._useCompression;

            const bulkCommandPromise = this._requestExecutor.execute(bulkCommand);

            this._pipelineFinished = pipelineAsync(this._writer, this._requestBodyStream);
            this._writer.push("[");

            this._bulkInsertExecuteTask = Promise.all([
                bulkCommandPromise,
                this._pipelineFinished
            ]);

            this._bulkInsertExecuteTask
                .catch(() => this._completedWithError = true);

        } catch (e) {
            throwError("RavenException", "Unable to open bulk insert stream.", e);
        }
    }

    public async abort(): Promise<void> {
        this._aborted = true;

        if (this._operationId !== -1) {
            await this._waitForId();

            try {
                await this._requestExecutor.execute(new KillOperationCommand(this._operationId, this._nodeTag));
            } catch (err) {
                const bulkInsertError = getError("BulkInsertAbortedException",
                    "Unable to kill bulk insert operation, because it was not found on the server.", err);
                this._abortReject(bulkInsertError);
                return;
            }
        }

        this._abortReject(getError(
            "BulkInsertAbortedException", "Bulk insert was aborted by the user."));
    }

    public async finish(): Promise<void> {
        try {
            this._endPreviousCommandIfNeeded();

            if (this._writer) {
                this._writer.push("]");
                this._writer.push(null);
            }

            if (this._operationId === -1) {
                // closing without calling a single store.
                return;
            }

            if (this._completedWithError || this._aborted) {
                await this._checkIfBulkInsertWasAborted();
            }

            if (this._unsubscribeChanges) {
                this._unsubscribeChanges.dispose();
            }

            await Promise.race(
                [
                    this._bulkInsertExecuteTask || Promise.resolve(),
                    this._bulkInsertAborted || Promise.resolve()
                ]);
        } finally {
            if (this._timer) {
                this._timer.dispose();
            }
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
            const check = this._operation._concurrencyCheck();
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
                        this._operation._writer.push("]}},");
                        this._writePrefixForNewCommand();
                    }

                    this._timeSeriesInBatch++;

                    if (!this._first) {
                        this._operation._writeComma();
                    }

                    this._first = false;

                    this._operation._writer.push("[");
                    this._operation._writer.push(timestamp.getTime().toString());
                    this._operation._writeComma();

                    this._operation._writer.push(values.length.toString());
                    this._operation._writeComma();

                    let firstValue = true;

                    for (const value of values) {
                        if (!firstValue) {
                            this._operation._writeComma();
                        }

                        firstValue = false;
                        this._operation._writer.push((value ?? 0).toString());
                    }

                    if (tag) {
                        this._operation._writer.push(`,"`);
                        this._operation._writeString(tag);
                        this._operation._writer.push(`"`);
                    }

                    this._operation._writer.push("]");
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

            this._operation._writer.push(`{"Id":"`);
            this._operation._writeString(this._id);
            this._operation._writer.push(`","Type":"TimeSeriesBulkInsert","TimeSeries":{"Name":"`);
            this._operation._writeString(this._name);
            this._operation._writer.push(`","TimeFormat":"UnixTimeInMs","Appends":[`);
        }

        dispose(): void {
            this._operation._inProgressCommand = "None";

            if (!this._first) {
                this._operation._writer.push("]}}");
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

    private readonly _stream: Readable;
    private _skipOverwriteIfUnchanged: boolean;
    private readonly _id: number;
    public useCompression: boolean;

    public constructor(id: number, stream: Readable, nodeTag: string, skipOverwriteIfUnchanged: boolean) {
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
            duplex: "half",
            headers
        };
    }

    public async setResponseAsync(bodyStream: Stream, fromCache: boolean): Promise<string> {
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
