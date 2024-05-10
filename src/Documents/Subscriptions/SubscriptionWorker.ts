import { IDisposable } from "../../Types/Contracts.js";
import { DocumentType } from "../DocumentAbstractions.js";
import { getLogger } from "../../Utility/LogUtil.js";
import { DocumentStore } from "../DocumentStore.js";
import { SubscriptionWorkerOptions } from "./SubscriptionWorkerOptions.js";
import { SubscriptionBatch } from "./SubscriptionBatch.js";
import { Socket } from "node:net";
import { StringUtil } from "../../Utility/StringUtil.js";
import { getError, throwError, RavenErrorType } from "../../Exceptions/index.js";
import { TcpUtils } from "../../Utility/TcpUtils.js";
import { Transform, pipeline, Readable } from "node:stream";
import { TcpNegotiateParameters } from "../../ServerWide/Tcp/TcpNegotiateParameters.js";
import {
    SUBSCRIPTION_TCP_VERSION,
    SupportedFeatures,
    TcpConnectionHeaderMessage
} from "../../ServerWide/Tcp/TcpConnectionHeaderMessage.js";
import { OUT_OF_RANGE_STATUS, TcpNegotiation } from "../../ServerWide/Tcp/TcpNegotiation.js";
import { TcpConnectionHeaderResponse } from "../../ServerWide/Tcp/TcpConnectionHeaderResponse.js";
import { EventEmitter } from "node:events";
import { TimeUtil } from "../../Utility/TimeUtil.js";
import { ObjectUtil } from "../../Utility/ObjectUtil.js";
import { SubscriptionConnectionServerMessage } from "./SubscriptionConnectionServerMessage.js";
import { EmptyCallback } from "../../Types/Callbacks.js";
import { delay, wrapWithTimeout } from "../../Utility/PromiseUtil.js";
import { BatchFromServer, CounterIncludeItem } from "./BatchFromServer.js";
import { ServerNode } from "../../Http/ServerNode.js";
import { RequestExecutor } from "../../Http/RequestExecutor.js";
import { GetTcpInfoCommand, TcpConnectionInfo } from "../../ServerWide/Commands/GetTcpInfoCommand.js";
import { GetTcpInfoForRemoteTaskCommand } from "../Commands/GetTcpInfoForRemoteTaskCommand.js";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";
import { ServerCasing, ServerResponse } from "../../Types/index.js";
import { CONSTANTS } from "../../Constants.js";
import { TcpNegotiationResponse } from "../../ServerWide/Tcp/TcpNegotiationResponse.js";
import { randomUUID } from "node:crypto";
import { EOL } from "../../Utility/OsUtil.js";
import { Parser } from "../../ext/stream-json/Parser.js";
import { StreamValues } from "../../ext/stream-json/streamers/StreamValues.js";

type EventTypes = "afterAcknowledgment" | "onEstablishedSubscriptionConnection" | "connectionRetry" | "batch" | "error" | "end" | "unexpectedSubscriptionError";

export class SubscriptionWorker<T extends object> implements IDisposable {

    private readonly _documentType: DocumentType<T>;
    private readonly _revisions: boolean;
    private readonly _logger = getLogger({ module: "SubscriptionWorker" });
    private readonly _store: DocumentStore;
    private readonly _dbName: string;
    private _processingCanceled = false;
    private readonly _options: SubscriptionWorkerOptions<T>;
    private _tcpClient: Socket;
    private _parser: Transform;
    private _disposed: boolean = false;
    private _subscriptionTask: Promise<void>;
    private _forcedTopologyUpdateAttempts = 0;
    private _emitter = new EventEmitter();

    public constructor(options: SubscriptionWorkerOptions<T>,
                       withRevisions: boolean, documentStore: DocumentStore, dbName: string) {
        this._documentType = options.documentType;
        this._options = Object.assign({
            strategy: "OpenIfFree",
            maxDocsPerBatch: 4096,
            timeToWaitBeforeConnectionRetry: 5 * 1000,
            maxErroneousPeriod: 5 * 60 * 1000,
            workerId: randomUUID()
        }, options);
        this._revisions = withRevisions;

        if (StringUtil.isNullOrEmpty(options.subscriptionName)) {
            throwError("InvalidArgumentException", "SubscriptionConnectionOptions must specify the subscriptionName");
        }

        this._store = documentStore;
        this._dbName = documentStore.getEffectiveDatabase(dbName);
    }

    public getWorkerId() {
        //TODO: make sure it is filled in!
        return this._options.workerId;
    }

    public dispose(): void {
        if (this._disposed) {
            return;
        }

        this._disposed = true;
        this._processingCanceled = true;

        this._closeTcpClient(); // we disconnect immediately
        if (this._parser) {
            this._parser.end();
        }

        this._subscriptionLocalRequestExecutor?.dispose();
    }

    private _redirectNode: ServerNode;
    private _subscriptionLocalRequestExecutor: RequestExecutor;

    protected subscriptionTcpVersion: number;

    public get currentNodeTag() {
        return this._redirectNode ? this._redirectNode.clusterTag : null;
    }

    public get subscriptionName() {
        return this._options ? this._options.subscriptionName : null;
    }

    private async _connectToServer(): Promise<Socket> {
        const command = new GetTcpInfoForRemoteTaskCommand(
            "Subscription/" + this._dbName, this._dbName,
            this._options ? this._options.subscriptionName : null, true);

        const requestExecutor = this._store.getRequestExecutor(this._dbName);

        let tcpInfo: TcpConnectionInfo;

        if (this._redirectNode) {
            try {
                await requestExecutor.execute(command, null, {
                    chosenNode: this._redirectNode,
                    nodeIndex: null,
                    shouldRetry: false
                });
                tcpInfo = command.result;
            } catch (e) {
                if (e.name === "ClientVersionMismatchException") {
                    tcpInfo = await this._legacyTryGetTcpInfo(requestExecutor, this._redirectNode);
                } else {
                    // if we failed to talk to a node, we'll forget about it and let the topology to
                    // redirect us to the current node

                    this._redirectNode = null;

                    throw e;
                }
            }
        } else {
            try {
                await requestExecutor.execute(command);
                tcpInfo = command.result;

                if (tcpInfo.nodeTag) {
                    this._redirectNode = requestExecutor.getTopology().nodes
                        .find(x => x.clusterTag === tcpInfo.nodeTag);
                }
            } catch (e) {
                if (e.name === "ClientVersionMismatchException") {
                    tcpInfo = await this._legacyTryGetTcpInfo(requestExecutor);
                } else {
                    throw e;
                }
            }
        }

        const result = await TcpUtils.connectSecuredTcpSocket(
            tcpInfo,
            command.result.certificate,
            this._store.authOptions,
            "Subscription",
            (chosenUrl, tcpInfo, socket) => this._negotiateProtocolVersionForSubscription(chosenUrl, tcpInfo, socket));

        this._tcpClient = result.socket;

        this._supportedFeatures = result.supportedFeatures;

        if (this._supportedFeatures.protocolVersion <= 0) {
            throwError("InvalidOperationException",
                this._options.subscriptionName
                + " : TCP negotiation resulted with an invalid protocol version: "
                + this._supportedFeatures.protocolVersion);
        }

        await this._sendOptions(this._tcpClient, this._options);

        if (this._subscriptionLocalRequestExecutor) {
            this._subscriptionLocalRequestExecutor.dispose();
        }

        this._subscriptionLocalRequestExecutor = RequestExecutor.createForSingleNodeWithoutConfigurationUpdates(
            command.getRequestedNode().url,
            this._dbName,
            {
                authOptions: requestExecutor.getAuthOptions(),
                documentConventions: requestExecutor.conventions
            }
        );

        this._store.registerEvents(this._subscriptionLocalRequestExecutor);

        return this._tcpClient;
    }

    private async _negotiateProtocolVersionForSubscription(chosenUrl: string, tcpInfo: TcpConnectionInfo, socket: Socket): Promise<SupportedFeatures> {
        let compressionSupport: boolean = false;

        const version = this.subscriptionTcpVersion ?? SUBSCRIPTION_TCP_VERSION;
        if (version >= 53_000 && !this._store.conventions.isDisableTcpCompression) {
            compressionSupport = true;
        }

        const databaseName = this._store.getEffectiveDatabase(this._dbName);

        const parameters = {
            database: databaseName,
            operation: "Subscription",
            version: SUBSCRIPTION_TCP_VERSION,
            readResponseAndGetVersionCallback: url => this._readServerResponseAndGetVersion(url, socket),
            destinationNodeTag: this.currentNodeTag,
            destinationUrl: chosenUrl,
            destinationServerId: tcpInfo.serverId,
            licensedFeatures: {
                dataCompression: compressionSupport
            }
        } as TcpNegotiateParameters;

        return TcpNegotiation.negotiateProtocolVersion(socket, parameters);
    }


    private async _legacyTryGetTcpInfo(requestExecutor: RequestExecutor, node?: ServerNode) {
        const tcpCommand = new GetTcpInfoCommand("Subscription/" + this._dbName, this._dbName);
        try {
            if (node) {
                await requestExecutor.execute<TcpConnectionInfo>(tcpCommand, null, {
                    chosenNode: node,
                    shouldRetry: false,
                    nodeIndex: undefined
                });
            } else {
                await requestExecutor.execute(tcpCommand, null);
            }
        } catch (e) {
            this._redirectNode = null;
            throw e;
        }

        return tcpCommand.result;
    }

    private async _sendOptions(socket: Socket, options: SubscriptionWorkerOptions<T>) {
        const payload = {
            SubscriptionName: options.subscriptionName,
            TimeToWaitBeforeConnectionRetry:
                TimeUtil.millisToTimeSpan(options.timeToWaitBeforeConnectionRetry),
            IgnoreSubscriberErrors: options.ignoreSubscriberErrors || false,
            Strategy: options.strategy,
            MaxDocsPerBatch: options.maxDocsPerBatch,
            MaxErroneousPeriod:
                TimeUtil.millisToTimeSpan(options.maxErroneousPeriod),
            CloseWhenNoDocsLeft: options.closeWhenNoDocsLeft || false,
        };

        return new Promise<void>(resolve => {
            socket.write(JSON.stringify(payload, null, 0), () => resolve());
        });
    }

    private async _ensureParser(socket: Socket): Promise<void> {
        const conventions = this._store.conventions;
        const revisions = this._revisions;

        const keysTransform = new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                let value = chunk["value"];
                if (!value) {
                    return callback();
                }

                value = SubscriptionWorker._mapToLocalObject(value, revisions, conventions);

                callback(null, {...chunk, value});
            }
        });

        this._parser = pipeline([
            socket,
            new Parser({ jsonStreaming: true, streamValues: false }),
            new StreamValues(),
            keysTransform
        ], err => {
            if (err && !socket.destroyed) {
                this._emitter.emit("error", err);
            }
        }) as Transform;

        this._parser.pause();
    }

    // noinspection JSUnusedLocalSymbols
    private async _readServerResponseAndGetVersion(url: string, socket: Socket): Promise<TcpNegotiationResponse> {
        await this._ensureParser(socket);
        const x: any = await this._readNextObject();
        switch (x.status) {
            case "Ok": {
                return {
                    version: x.version,
                    licensedFeatures: x.licensedFeatures
                }
            }
            case "AuthorizationFailed": {
                throwError("AuthorizationException",
                        "Cannot access database " + this._dbName + " because " + x.message);
                return;
            }
            case "TcpVersionMismatch": {
                if (x.version !== OUT_OF_RANGE_STATUS) {
                    return {
                        version: x.version,
                        licensedFeatures: x.licensedFeatures
                    }
                }

                //Kindly request the server to drop the connection
                await this._sendDropMessage(x.value);
                throwError("InvalidOperationException",
                    "Can't connect to database " + this._dbName + " because: " + x.message);
                break;
            }
            case "InvalidNetworkTopology": {
                throwError("InvalidNetworkTopologyException", "Failed to connect to url " + url + " because " + x.message);
            }
        }

        return {
            version: x.version,
            licensedFeatures: x.licensedFeatures
        };
    }

    private _sendDropMessage(reply: TcpConnectionHeaderResponse): Promise<void> {
        const dropMsg = {
            operation: "Drop",
            databaseName: this._dbName,
            operationVersion: SUBSCRIPTION_TCP_VERSION,
            info: "Couldn't agree on subscription tcp version ours: "
                + SUBSCRIPTION_TCP_VERSION + " theirs: " + reply.version
        } as TcpConnectionHeaderMessage;

        const payload = ObjectUtil.transformObjectKeys(dropMsg, {
            defaultTransform: ObjectUtil.pascal
        });

        return new Promise<void>(resolve => {
            this._tcpClient.write(JSON.stringify(payload, null, 0), () => resolve());
        });
    }

    private _assertConnectionState(connectionStatus: SubscriptionConnectionServerMessage) {
        if (connectionStatus.type === "Error") {
            if (connectionStatus.exception.includes("DatabaseDoesNotExistException")) {
                throwError("DatabaseDoesNotExistException",
                    this._dbName + " does not exists. " + connectionStatus.message);
            }
        }

        if (connectionStatus.type !== "ConnectionStatus") {
            let message = "Server returned illegal type message when expecting connection status, was:" + connectionStatus.type;

            if (connectionStatus.type === "Error") {
                message += ". Exception: " + connectionStatus.exception;
            }
            throwError("InvalidOperationException", message);
        }

        // noinspection FallThroughInSwitchStatementJS
        switch (connectionStatus.status) {
            case "Accepted": {
                break;
            }
            case "InUse": {
                throwError("SubscriptionInUseException",
                    "Subscription with id '" + this._options.subscriptionName
                    + "' cannot be opened, because it's in use and the connection strategy is "
                    + this._options.strategy);
                break;
            }
            case "Closed": {
                const canReconnect = connectionStatus.data.CanReconnect || false;
                const subscriptionClosedError = getError("SubscriptionClosedException",
                    "Subscription with id '" + this._options.subscriptionName
                    + "' was closed. " + connectionStatus.exception);
                (subscriptionClosedError as any).canReconnect = canReconnect;
                throw subscriptionClosedError;
            }
            case "Invalid": {
                throwError("SubscriptionInvalidStateException",
                    "Subscription with id '" + this._options.subscriptionName
                    + "' cannot be opened, because it is in invalid state. " + connectionStatus.exception);
                break;
            }
            case "NotFound": {
                throwError("SubscriptionDoesNotExistException",
                    "Subscription with id '" + this._options.subscriptionName
                    + "' cannot be opened, because it does not exist. " + connectionStatus.exception);
                break;
            }
            case "Redirect": {
                if (this._options.strategy === "WaitForFree") {
                    if (connectionStatus.data) {
                        const registerConnectionDurationInTicks = connectionStatus.data["RegisterConnectionDurationInTicks"];
                        if (registerConnectionDurationInTicks / 10_000 >= this._options.maxErroneousPeriod) {
                            // this worker connection Waited For Free for more than MaxErroneousPeriod
                            this._lastConnectionFailure = null;
                        }
                    }
                }

                const data = connectionStatus.data;
                const appropriateNode = data.redirectedTag;
                const currentNode = data.currentTag;
                const reasons = data.reasons;

                const error = getError("SubscriptionDoesNotBelongToNodeException",
                    "Subscription with id '" + this._options.subscriptionName
                    + "' cannot be processed by current node '" + currentNode + "', it will be redirected to " + appropriateNode + EOL + reasons);
                (error as any).appropriateNode = appropriateNode;
                throw error;
            }
            case "ConcurrencyReconnect": {
                throwError("SubscriptionChangeVectorUpdateConcurrencyException", connectionStatus.message);
                break;
            }
            default: {
                throwError("InvalidOperationException",
                    "Subscription '" + this._options.subscriptionName
                    + "' could not be opened, reason: " + connectionStatus.status);
            }
        }
    }

    private async _processSubscription() {
        let notifiedSubscriber = Promise.resolve();

        try {
            if (this._processingCanceled) {
                throwError("OperationCanceledException");
            }

            const socket = await this._connectToServer();

            let readFromServer = Promise.resolve<BatchFromServer>(null);
            try {
                if (this._processingCanceled) {
                    throwError("OperationCanceledException");
                }

                const tcpClientCopy = this._tcpClient;
                const connectionStatus: SubscriptionConnectionServerMessage = await this._readNextObject();

                if (this._processingCanceled) {
                    return;
                }

                if (connectionStatus.type !== "ConnectionStatus" || connectionStatus.status !== "Accepted") {
                    this._assertConnectionState(connectionStatus);
                }

                this._lastConnectionFailure = null;

                if (this._processingCanceled) {
                    return;
                }

                this._emitter.emit("onEstablishedSubscriptionConnection", this);

                const batch = new SubscriptionBatch<T>(this._documentType, this._revisions,
                    this._subscriptionLocalRequestExecutor, this._store, this._dbName);

                while (!this._processingCanceled) {
                    // start reading next batch from server on 1'st thread (can be before client started processing)

                    readFromServer = this._readSingleSubscriptionBatchFromServer(batch);

                    try {
                        // and then wait for the subscriber to complete
                        await notifiedSubscriber;
                    } catch (err) {
                        // if the subscriber errored, we shut down
                        this._closeTcpClient();

                        // noinspection ExceptionCaughtLocallyJS
                        throw err;
                    }

                    const incomingBatch = await readFromServer;

                    if (this._processingCanceled) {
                        throwError("OperationCanceledException");
                    }

                    const lastReceivedChangeVector = batch.initialize(incomingBatch);
                    notifiedSubscriber = this._emitBatchAndWaitForProcessing(batch)
                        .catch((err) => {
                            this._logger.error(err, "Subscription " + this._options.subscriptionName
                                + ". Subscriber threw an exception on document batch");

                            if (!this._options.ignoreSubscriberErrors) {
                                throwError("SubscriberErrorException",
                                    "Subscriber threw an exception in subscription "
                                    + this._options.subscriptionName, err);
                            }
                        })
                        .then(() => {
                            if (tcpClientCopy && tcpClientCopy.writable) {
                                return this._sendAck(lastReceivedChangeVector, tcpClientCopy);
                            }
                        });
                }
            } finally {
                socket.end();
                this._parser.end();

                try {
                    await notifiedSubscriber;
                } catch {
                    // we don't care anymore about errors from it
                }

                try {
                    await readFromServer;
                } catch {
                    // we don't care anymore about errors from it
                }
            }
        } catch (err) {
            if (!this._disposed) {
                throw err;
            }

            // otherwise this is thrown when shutting down,
            // it isn't an error, so we don't need to treat it as such
        } finally {
            try {
                await wrapWithTimeout(notifiedSubscriber, 15_000);
            } catch {
                // ignore
            }
        }
    }

    private async _emitBatchAndWaitForProcessing(batch): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let listenerCount = this._emitter.listenerCount("batch");
            this._emitter.emit("batch", batch, (error?: any) => {
                if (error) {
                    reject(error);
                } else {
                    listenerCount--;
                    if (!listenerCount) {
                        resolve();
                    }
                }
            });
        });
    }

    private async _readSingleSubscriptionBatchFromServer(batch: SubscriptionBatch<T>):
        Promise<BatchFromServer> {
        const incomingBatch = [] as SubscriptionConnectionServerMessage[];
        const includes: any[] = [];
        const counterIncludes: CounterIncludeItem[] = [];
        const timeSeriesIncludes: any = [];

        let endOfBatch = false;

        while (!endOfBatch && !this._processingCanceled) {
            const receivedMessage = await this._readNextObject();
            if (!receivedMessage || this._processingCanceled) {
                break;
            }

            switch (receivedMessage.type) {
                case "Data": {
                    incomingBatch.push(receivedMessage);
                    break;
                }
                case "Includes": {
                    includes.push(receivedMessage.includes);
                    break;
                }
                case "CounterIncludes": {
                    counterIncludes.push({ counterIncludes: receivedMessage.includedCounterNames, includes: receivedMessage.counterIncludes });
                    break;
                }
                case "TimeSeriesIncludes": {
                    timeSeriesIncludes.push(receivedMessage.timeSeriesIncludes);
                    break;
                }
                case "EndOfBatch": {
                    endOfBatch = true;
                    break;
                }
                case "Confirm": {
                    this._emitter.emit("afterAcknowledgment", batch);

                    incomingBatch.length = 0;
                    batch.items.length = 0;
                    break;
                }
                case "ConnectionStatus": {
                    this._assertConnectionState(receivedMessage);
                    break;
                }
                case "Error": {
                    this._throwSubscriptionError(receivedMessage);
                    break;
                }
                default: {
                    this._throwInvalidServerResponse(receivedMessage);
                    break;
                }

            }
        }
        return {
            messages: incomingBatch,
            includes,
            counterIncludes,
            timeSeriesIncludes
        };
    }

    private _throwInvalidServerResponse(receivedMessage: SubscriptionConnectionServerMessage) {
        throwError("InvalidArgumentException",
            "Unrecognized message " + receivedMessage.type + " type received from server");
    }

    private _throwSubscriptionError(receivedMessage: SubscriptionConnectionServerMessage) {
        throwError("InvalidOperationException",
            "Connection terminated by server. Exception: " + (receivedMessage.exception || "None"));
    }

    private async _readNextObject(): Promise<SubscriptionConnectionServerMessage> {
        const stream: Readable = this._parser;
        if (this._processingCanceled) {
            return null;
        }

        if (this._disposed) { // if we are disposed, nothing to do...
            return null;
        }

        if (stream.readable) {
            const data: { key: number, value: SubscriptionConnectionServerMessage } = stream.read() as any;
            if (data) {
                return data.value;
            }
        }

        return new Promise<void>((resolve, reject) => {
            stream.once("readable", readableListener);
            stream.once("error", errorHandler);
            stream.once("end", endHandler);

            function readableListener() {
                stream.removeListener("error", errorHandler);
                stream.removeListener("end", endHandler);
                resolve();
            }

            function errorHandler(err) {
                stream.removeListener("readable", readableListener);
                stream.removeListener("end", endHandler);
                reject(err);
            }

            function endHandler() {
                stream.removeListener("readable", readableListener);
                stream.removeListener("error", errorHandler);
                reject(getError("SubscriptionException", "Subscription stream has ended unexpectedly."));
            }
        })
        .then(() => this._readNextObject());
    }

    private async _sendAck(lastReceivedChangeVector: string, networkStream: Socket): Promise<void> {
        const payload = {
            ChangeVector: lastReceivedChangeVector,
            Type: "Acknowledge"
        };

        return new Promise<void>((resolve, reject) => {
            networkStream.write(JSON.stringify(payload, null, 0), (err) => {
                err ? reject(err) : resolve();
            });
        });
    }

    private async _runSubscriptionAsync(): Promise<void> {
        while (!this._processingCanceled) {
            try {
                this._closeTcpClient();

                this._logger.info("Subscription " + this._options.subscriptionName + ". Connecting to server...");
                await this._processSubscription();
            } catch (error) {
                if (this._processingCanceled) {
                    if (!this._disposed) {
                        throw error;
                    }
                    return;
                }

                this._logger.warn(error, "Subscription "
                    + this._options.subscriptionName + ". Pulling task threw the following exception. ");

                if (this._shouldTryToReconnect(error)) {
                    await delay(this._options.timeToWaitBeforeConnectionRetry);

                    if (!this._redirectNode) {
                        const reqEx = this._store.getRequestExecutor(this._dbName);
                        const curTopology = reqEx.getTopologyNodes();
                        const nextNodeIndex = (this._forcedTopologyUpdateAttempts++) % curTopology.length;
                        try {
                            const indexAndNode = await reqEx.getRequestedNode(curTopology[nextNodeIndex].clusterTag, true);
                            this._redirectNode = indexAndNode.currentNode;

                            this._logger.info("Subscription " + this._options.subscriptionName + ". Will modify redirect node from null to " + this._redirectNode.clusterTag);
                        } catch {
                            // will let topology to decide
                            this._logger.info("Subscription '" + this._options.subscriptionName + "'. Could not select the redirect node will keep it null.");
                        }
                    }

                    this._emitter.emit("connectionRetry", error);
                } else {
                    this._logger.error(error, "Connection to subscription "
                        + this._options.subscriptionName + " have been shut down because of an error.");

                    throw error;
                }
            }
        }
    }

    private _lastConnectionFailure: Date;
    private _supportedFeatures: SupportedFeatures;

    private _assertLastConnectionFailure(lastError: Error) {
        if (!this._lastConnectionFailure) {
            this._lastConnectionFailure = new Date();
            return;
        }

        const maxErroneousPeriod =  this._options.maxErroneousPeriod;
        const erroneousPeriodDuration = Date.now() - this._lastConnectionFailure.getTime();
        if (erroneousPeriodDuration > maxErroneousPeriod) {
            throwError("SubscriptionInvalidStateException",
                "Subscription connection was in invalid state for more than "
                + maxErroneousPeriod + " and therefore will be terminated.", lastError);
        }
    }

    private _shouldTryToReconnect(ex: Error) {
        if (ex.name === ("SubscriptionDoesNotBelongToNodeException" as RavenErrorType)) {

            const requestExecutor = this._store.getRequestExecutor(this._dbName);

            const appropriateNode = (ex as any).appropriateNode;
            if (!appropriateNode) {
                this._assertLastConnectionFailure(ex);
                this._redirectNode = null;
                return true;
            }

            const nodeToRedirectTo = requestExecutor.getTopologyNodes()
                .find(x => x.clusterTag === appropriateNode);

            if (!nodeToRedirectTo) {
                throwError("InvalidOperationException",
                    "Could not redirect to " + appropriateNode
                    + ", because it was not found in local topology, even after retrying");
            }

            this._redirectNode = nodeToRedirectTo;
            return true;
        } else if (ex.name === "DatabaseDisabledException" || ex.name === "AllTopologyNodesDownException") {
            this._assertLastConnectionFailure(ex);
            return true;
        } else if (ex.name === "NodeIsPassiveException") {
            // if we failed to talk to a node, we'll forget about it and let the topology to
            // redirect us to the current node
            this._redirectNode = null;
            return true;
        } else if (ex.name === "SubscriptionChangeVectorUpdateConcurrencyException") {
            return true;
        } else if (ex.name === "SubscriptionClosedException") {
            if ((ex as any).canReconnect) {
                return true;
            }

            this._processingCanceled = true;
            return false;
        }

        if (ex.name === "SubscriptionInUseException"
            || ex.name === "SubscriptionDoesNotExistException"
            || ex.name === "SubscriptionInvalidStateException"
            || ex.name === "DatabaseDoesNotExistException"
            || ex.name === "AuthorizationException"
            || ex.name === "SubscriberErrorException") {
            this._processingCanceled = true;
            return false;
        }

        this._emitter.emit("unexpectedSubscriptionError", ex);

        this._assertLastConnectionFailure(ex);
        return true;
    }

    private _closeTcpClient() {
        if (this._tcpClient) {
            this._tcpClient.end();
        }
    }

    public on(event: "batch",
              handler: (value: SubscriptionBatch<T>, callback: EmptyCallback) => void): this;
    public on(event: "error",
              handler: (error?: Error) => void): this;
    public on(event: "end",
              handler: (error?: Error) => void): this;
    public on(event: "unexpectedSubscriptionError",
              handler: (error?: Error) => void): this;
    public on(event: "onEstablishedSubscriptionConnection", handler: (value: SubscriptionWorker<any>) => void): this;
    public on(event: "afterAcknowledgment",
              handler: (value: SubscriptionBatch<T>, callback: EmptyCallback) => void): this;
    public on(event: "connectionRetry",
              handler: (error?: Error) => void): this;
    public on(event: EventTypes,
              handler:
                  ((batchOrError: SubscriptionBatch<T>, callback: EmptyCallback) => void)
                  | ((value: SubscriptionWorker<any>) => void)
                  | ((error: Error) => void)): this {
        this._emitter.on(event, handler);

        if (event === "batch" && !this._subscriptionTask) {
            this._subscriptionTask = this._runSubscriptionAsync()
                .catch(err => { this._emitter.emit("error", err); })
                .then(() => { this._emitter.emit("end"); });
        }

        return this;
    }

    public off(event: "batch", handler: (value: SubscriptionBatch<T>, callback: EmptyCallback) => void): this;
    public off(event: "error", handler: (error?: Error) => void): this;
    public off(event: "unexpectedSubscriptionError", handler: (error?: Error) => void): this;
    public off(event: "onEstablishedSubscriptionConnection", handler: (value: SubscriptionWorker<any>) => void): this;
    public off(event: "end", handler: (error?: Error) => void): this;
    public off(event: "afterAcknowledgment", handler: (value: SubscriptionBatch<T>, callback: EmptyCallback) => void): this;
    public off(event: "connectionRetry", handler: (error?: Error) => void): this;
    public off(event: EventTypes,
               handler:
                  ((batchOrError: SubscriptionBatch<T>, callback: EmptyCallback) => void)
                  | ((value: SubscriptionWorker<any>) => void)
                  | ((error: Error) => void)): this {
        this._emitter.removeListener(event, handler);
        return this;
    }

    public removeListener(event: "batch", handler: (value: SubscriptionBatch<T>, callback: EmptyCallback) => void): this;
    public removeListener(event: "error", handler: (error?: Error) => void): this;
    public removeListener(event: "unexpectedSubscriptionError", handler: (error?: Error) => void): this;
    public removeListener(event: "onEstablishedSubscriptionConnection", handler: (value: SubscriptionWorker<any>) => void): this;
    public removeListener(event: "end", handler: (error?: Error) => void): this;
    public removeListener(
        event: "afterAcknowledgment", handler: (value: SubscriptionBatch<T>, callback: EmptyCallback) => void): this;
    public removeListener(event: "connectionRetry", handler: (error?: Error) => void): this;
    public removeListener(
        event: EventTypes,
        handler:
            ((batchOrError: SubscriptionBatch<T>, callback: EmptyCallback) => void)
            | ((value: SubscriptionWorker<any>) => void)
            | ((error: Error) => void)): this {
        this.removeListener(event as any, handler as any);
        return this;
    }

    private static _mapToLocalObject(json: ServerCasing<ServerResponse<SubscriptionConnectionServerMessage>>, revisions: boolean, conventions: DocumentConventions): SubscriptionConnectionServerMessage {
        const { Data, Includes, CounterIncludes, TimeSeriesIncludes, ...rest } = json;

        let data: any;
        if (Data) {
            if (revisions) {
                data = {
                    current: ObjectUtil.transformDocumentKeys(Data.Current, conventions),
                    previous: ObjectUtil.transformDocumentKeys(Data.Previous, conventions),
                    [CONSTANTS.Documents.Metadata.KEY]: ObjectUtil.transformMetadataKeys(Data[CONSTANTS.Documents.Metadata.KEY], conventions)
                }
            } else {
                data = ObjectUtil.transformDocumentKeys(Data, conventions);
            }
        }

        return {
            ...ObjectUtil.transformObjectKeys(rest, {
                defaultTransform: ObjectUtil.camel
            }),
            data,
            includes: ObjectUtil.mapIncludesToLocalObject(Includes, conventions),
            counterIncludes: ObjectUtil.mapCounterIncludesToLocalObject(CounterIncludes),
            timeSeriesIncludes: ObjectUtil.mapTimeSeriesIncludesToLocalObject(TimeSeriesIncludes),
        } as SubscriptionConnectionServerMessage;
    }

}
