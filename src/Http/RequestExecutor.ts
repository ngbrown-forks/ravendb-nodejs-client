import { Readable } from "node:stream";
import { acquireSemaphore, SemaphoreAcquisitionContext } from "../Utility/SemaphoreUtil.js";
import { getLogger, ILogger } from "../Utility/LogUtil.js";
import { Timer } from "../Primitives/Timer.js";
import { ServerNode } from "./ServerNode.js";
import { RavenCommand, ResponseDisposeHandling } from "./RavenCommand.js";
import { Topology } from "./Topology.js";
import { GetDatabaseTopologyCommand } from "../ServerWide/Commands/GetDatabaseTopologyCommand.js";
import { StatusCodes } from "./StatusCode.js";
import { NodeSelector } from "./NodeSelector.js";
import { IDisposable } from "../Types/Contracts.js";
import { IRequestAuthOptions, IAuthOptions } from "../Auth/AuthOptions.js";
import { Certificate, ICertificate } from "../Auth/Certificate.js";
import { HttpCache, CachedItemMetadata, ReleaseCacheItem } from "./HttpCache.js";
import { AggressiveCacheOptions } from "./AggressiveCacheOptions.js";
import { throwError, RavenErrorType, ExceptionDispatcher, ExceptionSchema, getError } from "../Exceptions/index.js";
import {
    GetClientConfigurationCommand,
} from "../Documents/Operations/Configuration/GetClientConfigurationOperation.js";
import CurrentIndexAndNode from "./CurrentIndexAndNode.js";
import { HEADERS } from "../Constants.js";
import { HttpRequestParameters, HttpResponse, HttpRequestParametersWithoutUri } from "../Primitives/Http.js";
import { raceToResolution } from "../Utility/PromiseUtil.js";
import { GetStatisticsOperation } from "../Documents/Operations/GetStatisticsOperation.js";
import { DocumentConventions } from "../Documents/Conventions/DocumentConventions.js";
import { TypeUtil } from "../Utility/TypeUtil.js";
import { SessionInfo } from "../Documents/Session/IDocumentSession.js";
import { JsonSerializer } from "../Mapping/Json/Serializer.js";
import { validateUri } from "../Utility/UriUtil.js";
import { readToEnd } from "../Utility/StreamUtil.js";
import { closeHttpResponse } from "../Utility/HttpUtil.js";
import { PromiseStatusTracker } from "../Utility/PromiseUtil.js";
import { IBroadcast } from "./IBroadcast.js";
import { StringUtil } from "../Utility/StringUtil.js";
import { IRaftCommand } from "./IRaftCommand.js";
import { EventEmitter } from "node:events";
import {
    BeforeRequestEventArgs,
    FailedRequestEventArgs,
    SucceedRequestEventArgs,
    TopologyUpdatedEventArgs
} from "../Documents/Session/SessionEvents.js";
import { TimeUtil } from "../Utility/TimeUtil.js";
import { UpdateTopologyParameters } from "./UpdateTopologyParameters.js";
import { randomUUID } from "node:crypto";
import { DatabaseHealthCheckOperation } from "../Documents/Operations/DatabaseHealthCheckOperation.js";
import { GetNodeInfoCommand } from "../ServerWide/Commands/GetNodeInfoCommand.js";
import { Semaphore } from "../Utility/Semaphore.js";
import { Dispatcher, Agent } from "undici-types";
import { EOL } from "../Utility/OsUtil.js";
import { importFix } from "../Utility/ImportUtil.js";

const DEFAULT_REQUEST_OPTIONS = {};

const log = getLogger({ module: "RequestExecutor" });

export interface ExecuteOptions<TResult> {
    chosenNode: ServerNode;
    nodeIndex: number;
    shouldRetry: boolean;
    abortRef?: (controller: AbortController) => void;
}

export interface ITopologyUpdateEvent {
    topologyJson: object;
    serverNodeUrl: string;
    requestedDatabase?: string;
    forceUpdate?: boolean;
    wasUpdated?: boolean;
}

export interface IRequestExecutorOptions {
    authOptions?: IRequestAuthOptions;
    documentConventions?: DocumentConventions;
}

class IndexAndResponse {
    public readonly index: number;
    public readonly response: HttpResponse;
    public readonly bodyStream: Readable

    public constructor(index: number, response: HttpResponse, bodyStream: Readable) {
        this.index = index;
        this.response = response;
        this.bodyStream = bodyStream;
    }
}

export class NodeStatus implements IDisposable {

    private _nodeStatusCallback: (nodeStatus: NodeStatus) => Promise<void>;
    private _timerPeriodInMs: number;
    public readonly nodeIndex: number;
    public readonly node: ServerNode;
    public readonly requestExecutor: RequestExecutor;
    private _timer: Timer;

    public constructor(
        nodeIndex: number,
        node: ServerNode,
        requestExecutor: RequestExecutor,
        nodeStatusCallback: (nodeStatus: NodeStatus) => Promise<void>) {
        this.nodeIndex = nodeIndex;
        this.node = node;
        this.requestExecutor = requestExecutor;
        this._timerPeriodInMs = 100;
        this._nodeStatusCallback = nodeStatusCallback;
    }

    private _nextTimerPeriod(): number {
        if (this._timerPeriodInMs <= 5000) {
            return 5000;
        }

        this._timerPeriodInMs = this._timerPeriodInMs + 100;

        return this._timerPeriodInMs;
    }

    public startTimer(): void {
        this._timer = new Timer(() => {
            if (this.requestExecutor.disposed) {
                this.dispose();
                return;
            }

            return this._nodeStatusCallback(this);
        }, this._timerPeriodInMs);
    }

    public updateTimer(): void {
        this._timer.change(this._nextTimerPeriod());
    }

    public dispose(): void {
        this._timer.dispose();
    }
}

export class RequestExecutor implements IDisposable {
    private _emitter = new EventEmitter();

    /*
      we don't initialize this here due to issue with cloudflare
      see: https://github.com/cloudflare/miniflare/issues/292
     */
    private static GLOBAL_APPLICATION_IDENTIFIER: string = null;

    private static readonly INITIAL_TOPOLOGY_ETAG = -2;

    private _log: ILogger;

    public static readonly CLIENT_VERSION = "6.0.0";

    private _updateDatabaseTopologySemaphore = new Semaphore();
    private _updateClientConfigurationSemaphore = new Semaphore();

    private static _backwardCompatibilityFailureCheckOperation = new GetStatisticsOperation("failure=check");
    private static readonly _failureCheckOperation = new DatabaseHealthCheckOperation();
    private static readonly _useOldFailureCheckOperation = new Set<string>();

    private _failedNodesTimers: Map<ServerNode, NodeStatus> = new Map();
    protected _databaseName: string;
    protected _certificate: ICertificate = null;

    private _lastReturnedResponse: Date;

    private readonly _cache: HttpCache;

    private _topologyTakenFromNode: ServerNode;

    public aggressiveCaching: AggressiveCacheOptions = null;

    private _updateTopologyTimer: Timer;

    protected _nodeSelector: NodeSelector;

    private _defaultTimeout: number | null;

    public numberOfServerRequests: number = 0;

    protected _disposed: boolean;

    protected _firstTopologyUpdatePromiseInternal;

    private _httpAgent: Dispatcher;

    /*
      we don't initialize this here due to issue with cloudflare
      see: https://github.com/cloudflare/miniflare/issues/292
    */
    private static KEEP_ALIVE_HTTP_AGENT: Dispatcher = null;

    private static readonly HTTPS_AGENT_CACHE = new Map<string, Dispatcher>();

    protected get firstTopologyUpdatePromise(): Promise<void> {
        return this._firstTopologyUpdatePromiseInternal;
    }

    protected set firstTopologyUpdatePromise(value: Promise<void>) {
        this._firstTopologyUpdatePromiseInternal = value;

        if (value) {
            this._firstTopologyUpdateStatus = PromiseStatusTracker.track(value);
        }
    }

    protected _firstTopologyUpdateStatus: PromiseStatusTracker<void>;

    protected _lastKnownUrls: string[];

    protected _clientConfigurationEtag: string = "0";

    protected _topologyEtag: number = 0;

    private readonly _conventions: DocumentConventions;

    private readonly _authOptions: IAuthOptions;

    protected _disableTopologyUpdates: boolean;

    protected _disableClientConfigurationUpdates: boolean;

    protected _topologyHeaderName: string = HEADERS.TOPOLOGY_ETAG;

    protected _lastServerVersion: string;

    protected _customHttpRequestOptions: HttpRequestParametersWithoutUri;

    protected _defaultRequestOptions: HttpRequestParametersWithoutUri;

    public static requestPostProcessor: (req: HttpRequestParameters) => void = null;

    public get customHttpRequestOptions(): HttpRequestParametersWithoutUri {
        return this._customHttpRequestOptions;
    }

    public set customHttpRequestOptions(value: HttpRequestParametersWithoutUri) {
        this._customHttpRequestOptions = value;
        this._setDefaultRequestOptions();
    }

    public getAuthOptions(): IAuthOptions {
        return this._authOptions;
    }

    public getTopologyEtag() {
        return this._topologyEtag;
    }

    public get lastServerVersion() {
        return this._lastServerVersion;
    }

    public get defaultTimeout() {
        return this._defaultTimeout;
    }

    public set defaultTimeout(timeout: number) {
        this._defaultTimeout = timeout;
    }

    private _secondBroadcastAttemptTimeout: number;

    public get secondBroadcastAttemptTimeout() {
        return this._secondBroadcastAttemptTimeout;
    }

    public set secondBroadcastAttemptTimeout(timeout: number) {
        this._secondBroadcastAttemptTimeout = timeout;
    }

    private _firstBroadcastAttemptTimeout: number;

    public get firstBroadcastAttemptTimeout() {
        return this._firstBroadcastAttemptTimeout;
    }

    public set firstBroadcastAttemptTimeout(timeout: number) {
        this._firstBroadcastAttemptTimeout = timeout;
    }

    public on(event: "topologyUpdated", handler: (value: TopologyUpdatedEventArgs) => void): this;
    public on(event: "failedRequest", handler: (value: FailedRequestEventArgs) => void): this;
    public on(event: "beforeRequest", handler: (value: BeforeRequestEventArgs) => void): this;
    public on(event: "succeedRequest", handler: (value: SucceedRequestEventArgs) => void): this;
    public on(event: string, handler: (value: any) => void): this {
        this._emitter.on(event, handler);
        return this;
    }

    public off(event: "topologyUpdated", handler: (value: TopologyUpdatedEventArgs) => void): this;
    public off(event: "failedRequest", handler: (value: FailedRequestEventArgs) => void): this;
    public off(event: "beforeRequest", handler: (value: BeforeRequestEventArgs) => void): this;
    public off(event: "succeedRequest", handler: (value: SucceedRequestEventArgs) => void): this;
    public off(event: string, handler: (value: any) => void): this {
        this._emitter.off(event, handler);
        return this;
    }

    private _onFailedRequestInvoke(url: string, e: Error, req?: HttpRequestParameters, response?: HttpResponse) {
        const args = new FailedRequestEventArgs(this._databaseName, url, e, req, response);
        this._emitter.emit("failedRequest", args);
    }

    public get conventions() {
        return this._conventions;
    }

    public getClientConfigurationEtag() {
        return this._clientConfigurationEtag;
    }

    public get cache() {
        return this._cache;
    }

    public get disposed() {
        return this._disposed;
    }

    public getUrl(): string {
        if (!this._nodeSelector) {
            return null;
        }

        const preferredNode = this._nodeSelector.getPreferredNode();

        return preferredNode
            ? preferredNode.currentNode.url
            : null;
    }

    public getTopology(): Topology {
        return this._nodeSelector
            ? this._nodeSelector.getTopology()
            : null;
    }

    public async getHttpAgent(): Promise<Dispatcher> {
        if (this.conventions.customFetch) {
            return null;
        }

        if (this._httpAgent) {
            return this._httpAgent;
        }

        return this._httpAgent = await this._createHttpAgent();
    }

    private async _createHttpAgent(): Promise<Dispatcher> {
        if (this._certificate) {
            const agentOptions = this._certificate.toAgentOptions();
            const cacheKey = JSON.stringify(agentOptions, null, 0);
            if (RequestExecutor.HTTPS_AGENT_CACHE.has(cacheKey)) {
                return RequestExecutor.HTTPS_AGENT_CACHE.get(cacheKey);
            } else {
                const agent = await RequestExecutor.createAgent(agentOptions);

                RequestExecutor.HTTPS_AGENT_CACHE.set(cacheKey, agent);
                return agent;
            }
        } else {
            return RequestExecutor.KEEP_ALIVE_HTTP_AGENT ??= await RequestExecutor.createAgent({
                pipelining: 0
            });
        }
    }

    private static async createAgent(options: Agent.Options) {
        try {
            const { Agent: AgentInstance } = await import(importFix("undici"));
            return new AgentInstance(options);
        } catch (err) {
            // If we can't import undici - we might be in cloudflare env - simply return no-agent.
            return null;
        }
    }

    public getTopologyNodes(): ServerNode[] {
        const topology = this.getTopology();
        return topology
            ? [...topology.nodes]
            : null;
    }

    protected constructor(
        database: string,
        authOptions: IRequestAuthOptions,
        conventions: DocumentConventions) {

        this._log = getLogger({
            module: `${this.constructor.name}-${ Math.floor(Math.random() * 10000) }`
        });

        this._cache = new HttpCache(conventions.maxHttpCacheSize);
        this._databaseName = database;
        this._lastReturnedResponse = new Date();
        this._conventions = conventions.clone();
        this._authOptions = authOptions;
        this._certificate = Certificate.createFromOptions(this._authOptions);
        this._setDefaultRequestOptions();

        this._defaultTimeout = conventions.requestTimeout;
        this._secondBroadcastAttemptTimeout = conventions.secondBroadcastAttemptTimeout;
        this._firstBroadcastAttemptTimeout = conventions.firstBroadcastAttemptTimeout;
    }

    public static create(
        initialUrls: string[],
        database: string): RequestExecutor;
    public static create(
        initialUrls: string[],
        database: string,
        opts?: IRequestExecutorOptions): RequestExecutor;
    public static create(
        initialUrls: string[],
        database: string,
        opts?: IRequestExecutorOptions): RequestExecutor {
        const { authOptions, documentConventions } = opts || {} as IRequestExecutorOptions;
        const executor = new RequestExecutor(database, authOptions, documentConventions);

        executor.firstTopologyUpdatePromise = executor._firstTopologyUpdate(initialUrls, RequestExecutor.getGlobalApplicationIdentifier());

        // this is just to get rid of unhandled rejection, we're handling it later on
        executor.firstTopologyUpdatePromise.catch(TypeUtil.NOOP);

        return executor;
    }

    private static getGlobalApplicationIdentifier() {
        // due to cloudflare constraints we can't init GLOBAL_APPLICATION_IDENTIFIER in static

        if (!this.GLOBAL_APPLICATION_IDENTIFIER) {
            this.GLOBAL_APPLICATION_IDENTIFIER = randomUUID();
        }

        return this.GLOBAL_APPLICATION_IDENTIFIER;
    }

    public static createForSingleNodeWithConfigurationUpdates(
        url: string, database: string, opts: IRequestExecutorOptions): RequestExecutor {
        const executor =
            this.createForSingleNodeWithoutConfigurationUpdates(
                url, database, opts);
        executor._disableClientConfigurationUpdates = false;
        return executor;
    }

    public static createForSingleNodeWithoutConfigurationUpdates(
        url: string, database: string, opts: IRequestExecutorOptions) {

        const { authOptions, documentConventions } = opts;
        const initialUrls: string[] = RequestExecutor.validateUrls([url], authOptions);

        const executor = new RequestExecutor(database, authOptions, documentConventions);
        const topology: Topology = new Topology();
        topology.etag = -1;

        const serverNode = new ServerNode({
            url: initialUrls[0],
            database,
            serverRole: "Member"
        });

        topology.nodes = [serverNode];

        executor._nodeSelector = new NodeSelector(topology);
        executor._topologyEtag = RequestExecutor.INITIAL_TOPOLOGY_ETAG;
        executor._disableTopologyUpdates = true;
        executor._disableClientConfigurationUpdates = true;
        executor.firstTopologyUpdatePromise = executor._singleTopologyUpdateAsync(initialUrls, this.GLOBAL_APPLICATION_IDENTIFIER);

        return executor;
    }

    protected async _updateClientConfiguration(serverNode: ServerNode): Promise<void> {
        if (this._disposed) {
            return;
        }

        let semAcquiredContext: SemaphoreAcquisitionContext;

        try {
            semAcquiredContext = acquireSemaphore(this._updateClientConfigurationSemaphore);
            await semAcquiredContext.promise;
            await this._updateClientConfigurationInternal(serverNode);
        } finally {
            if (semAcquiredContext) {
                semAcquiredContext.dispose();
            }
        }
    }

    private async _updateClientConfigurationInternal(serverNode: ServerNode): Promise<void> {
        const oldDisableClientConfigurationUpdates = this._disableClientConfigurationUpdates;
        this._disableClientConfigurationUpdates = true;

        try {
            if (this._disposed) {
                return;
            }

            const command = new GetClientConfigurationCommand();
            await this.execute(command, null, {
                chosenNode: serverNode,
                nodeIndex: null,
                shouldRetry: false
            });

            const clientConfigOpResult = command.result;
            if (!clientConfigOpResult) {
                return;
            }

            this._conventions.updateFrom(clientConfigOpResult.configuration);
            this._clientConfigurationEtag = clientConfigOpResult.etag;
        } catch (err) {
            this._log.error(err, "Error getting client configuration.");
        } finally {
            this._disableClientConfigurationUpdates = oldDisableClientConfigurationUpdates;
        }
    }

    public async updateTopology(parameters: UpdateTopologyParameters): Promise<boolean> {
        if (this._disableTopologyUpdates) {
            return false;
        }

        if (this._disposed) {
            return false;
        }

        const acquiredSemContext = acquireSemaphore(this._updateDatabaseTopologySemaphore, { timeout: parameters.timeoutInMs });

        try {
            await acquiredSemContext.promise;

            if (this._disposed) {
                return false;
            }

            this._log.info(`Update topology from ${parameters.node.url}.`);

            const getTopology = new GetDatabaseTopologyCommand(parameters.debugTag, this.conventions.sendApplicationIdentifier ? parameters.applicationIdentifier : null);

            if (this._defaultTimeout != null && this._defaultTimeout > getTopology.timeout) {
                getTopology.timeout = this._defaultTimeout;
            }

            await this.execute(getTopology, null, {
                chosenNode: parameters.node,
                nodeIndex: null,
                shouldRetry: false,
            });

            const topology = getTopology.result;
            if (!this._nodeSelector) {
                this._nodeSelector = new NodeSelector(topology);

                if (this.conventions.readBalanceBehavior === "FastestNode") {
                    this._nodeSelector.scheduleSpeedTest();
                }

            } else if (this._nodeSelector.onUpdateTopology(topology, parameters.forceUpdate)) {
                this._disposeAllFailedNodesTimers();

                if (this.conventions.readBalanceBehavior === "FastestNode") {
                    this._nodeSelector.scheduleSpeedTest();
                }
            }

            this._topologyEtag = this._nodeSelector.getTopology().etag;

            this._onTopologyUpdatedInvoke(topology);

            return true;
        } catch (reason) {
            if (reason.name === "TimeoutError") {
                return false;
            }

            throw reason;
        } finally {
            acquiredSemContext.dispose();
        }
    }

    protected _updateNodeSelector(topology: Topology, forceUpdate: boolean) {
        if (!this._nodeSelector) {
            this._nodeSelector = new NodeSelector(topology);

            if (this.conventions.readBalanceBehavior === "FastestNode") {
                this._nodeSelector.scheduleSpeedTest();
            }
        } else if (this._nodeSelector.onUpdateTopology(topology, forceUpdate)) {
            this._disposeAllFailedNodesTimers();

            if (this.conventions.readBalanceBehavior === "FastestNode") {
                this._nodeSelector.scheduleSpeedTest();
            }
        }

        this._topologyEtag = this._nodeSelector.getTopology().etag;
    }

    protected _disposeAllFailedNodesTimers(): void {
        for (const item of this._failedNodesTimers) {
            item[1].dispose();
        }

        this._failedNodesTimers.clear();
    }

    public execute<TResult>(command: RavenCommand<TResult>): Promise<void>;
    public execute<TResult>(command: RavenCommand<TResult>, sessionInfo?: SessionInfo): Promise<void>;
    public execute<TResult>(
        command: RavenCommand<TResult>, sessionInfo?: SessionInfo, options?: ExecuteOptions<TResult>): Promise<void>;
    public execute<TResult>(
        command: RavenCommand<TResult>,
        sessionInfo?: SessionInfo,
        options?: ExecuteOptions<TResult>): Promise<void> {

        if (options) {
            return this._executeOnSpecificNode(command, sessionInfo, options);
        }

        this._log.info(`Execute command ${command.constructor.name}`);

        const topologyUpdate = this.firstTopologyUpdatePromise;
        const topologyUpdateStatus = this._firstTopologyUpdateStatus;
        if ((topologyUpdate && topologyUpdateStatus.isResolved())) {
            const currentIndexAndNode: CurrentIndexAndNode = this.chooseNodeForRequest(command, sessionInfo);
            return this._executeOnSpecificNode(command, sessionInfo, {
                chosenNode: currentIndexAndNode.currentNode,
                nodeIndex: currentIndexAndNode.currentIndex,
                shouldRetry: true
            });
        } else {
            return this._unlikelyExecute(command, topologyUpdate, sessionInfo);
        }
    }

    public chooseNodeForRequest<TResult>(cmd: RavenCommand<TResult>, sessionInfo: SessionInfo): CurrentIndexAndNode {
        if (!StringUtil.isNullOrWhitespace(cmd.selectedNodeTag)) {
            return this._nodeSelector.getRequestedNode(cmd.selectedNodeTag);
        }

        if (this.conventions.loadBalanceBehavior === "UseSessionContext") {
            if (sessionInfo && sessionInfo.canUseLoadBalanceBehavior()) {
                return this._nodeSelector.getNodeBySessionId(sessionInfo.getSessionId());
            }
        }

        if (!cmd.isReadRequest) {
            return this._nodeSelector.getPreferredNode();
        }

        switch (this.conventions.readBalanceBehavior) {
            case "None": {
                return this._nodeSelector.getPreferredNode();
            }
            case "RoundRobin": {
                return this._nodeSelector.getNodeBySessionId(sessionInfo ? sessionInfo.getSessionId() : 0);
            }
            case "FastestNode": {
                return this._nodeSelector.getFastestNode();
            }
            default: {
                throwError("NotSupportedException", `Invalid read balance behavior: ${this.conventions.readBalanceBehavior}`);
            }
        }
    }

    private async _unlikelyExecute<TResult>(
        command: RavenCommand<TResult>,
        topologyUpdate: Promise<void>,
        sessionInfo: SessionInfo): Promise<void> {

        await this._waitForTopologyUpdate(topologyUpdate);

        const currentIndexAndNode: CurrentIndexAndNode = this.chooseNodeForRequest(command, sessionInfo);
        return this._executeOnSpecificNode(command, sessionInfo, {
            chosenNode: currentIndexAndNode.currentNode,
            nodeIndex: currentIndexAndNode.currentIndex,
            shouldRetry: true
        });
    }

    private async _waitForTopologyUpdate(topologyUpdate: Promise<void>) {
        try {
            if (!this.firstTopologyUpdatePromise) {
                if (!this._lastKnownUrls) {
                    // shouldn't happen
                    throwError("InvalidOperationException",
                        "No known topology and no previously known one, cannot proceed, likely a bug");
                }

                if (!this._disableTopologyUpdates) {
                    topologyUpdate = this._firstTopologyUpdate(this._lastKnownUrls, null);
                } else {
                    topologyUpdate = this._singleTopologyUpdateAsync(this._lastKnownUrls, null);
                }
            }

            await topologyUpdate;

        } catch (reason) {
            if (this.firstTopologyUpdatePromise === topologyUpdate) {
                this.firstTopologyUpdatePromise = null; // next request will raise it
            }

            this._log.warn(reason, "Error doing topology update.");

            throw reason;
        }
    }

    private _updateTopologyCallback(): Promise<void> {
        const time = new Date();
        const fiveMinutes = 5 * 60 * 1000;
        if (time.valueOf() - this._lastReturnedResponse.valueOf() <= fiveMinutes) {
            return;
        }

        let serverNode: ServerNode;

        try {
            const selector = this._nodeSelector;
            if (!selector) {
                return;
            }
            const preferredNode: CurrentIndexAndNode = selector.getPreferredNode();
            serverNode = preferredNode.currentNode;
        } catch (err) {
            this._log.warn(err, "Couldn't get preferred node Topology from _updateTopologyTimer");
            return;
        }

        const updateParameters = new UpdateTopologyParameters(serverNode);
        updateParameters.timeoutInMs = 0;
        updateParameters.debugTag = "timer-callback";

        return this.updateTopology(updateParameters)
            .catch(err => {
                this._log.error(err, "Couldn't update topology from _updateTopologyTimer");
                return null;
            });
    }

    protected async _singleTopologyUpdateAsync(initialUrls: string[], applicationIdentifier: string): Promise<void> {
        if (this.disposed) {
            return;
        }

        // fetch tag for each of the urls
        const topology = new Topology(this._topologyEtag, []);

        for (const url of initialUrls) {
            const serverNode = new ServerNode({
                url,
                database: this._databaseName
            });

            try {
                const command = new GetNodeInfoCommand();
                await this.execute(command, null, {
                    chosenNode: serverNode,
                    shouldRetry: false,
                    nodeIndex: null
                });

                serverNode.clusterTag = command.result.nodeTag;
                serverNode.serverRole = command.result.serverRole;
            } catch (e) {
                if (e.name === "AuthorizationException") {
                    // auth exceptions will always happen, on all nodes
                    // so errors immediately
                    this._lastKnownUrls = initialUrls;
                    throw e;
                } else if (e.name === "DatabaseDoesNotExistException") {
                    // Will happen on all node in the cluster,
                    // so errors immediately

                    this._lastKnownUrls = initialUrls;
                    throw e;
                } else {
                    serverNode.clusterTag = "!";
                }
            }

            topology.nodes.push(serverNode);
            this._updateNodeSelector(topology, true);
        }

        this._lastKnownUrls = initialUrls;
    }


    protected async _firstTopologyUpdate(inputUrls: string[], applicationIdentifier?: string): Promise<void> {
        const initialUrls: string[] = RequestExecutor.validateUrls(inputUrls, this._authOptions);

        const topologyUpdateErrors: { url: string, error: Error | string }[] = [];

        const tryUpdateTopology = async (url: string, database: string): Promise<boolean> => {
            const serverNode = new ServerNode({ url, database, serverRole: "Member" });
            try {
                const updateParameters = new UpdateTopologyParameters(serverNode);
                updateParameters.timeoutInMs = TypeUtil.MAX_INT32;
                updateParameters.debugTag = "first-topology-update";
                updateParameters.applicationIdentifier = applicationIdentifier;

                await this.updateTopology(updateParameters);
                this._initializeUpdateTopologyTimer();
                this._topologyTakenFromNode = serverNode;
                return true;
            } catch (error) {
                if ((error.name as RavenErrorType) === "AuthorizationException") {
                    this._lastKnownUrls = initialUrls;
                    throw error;
                }

                if ((error.name as RavenErrorType) === "DatabaseDoesNotExistException") {
                    this._lastKnownUrls = initialUrls;
                    throw error;
                }

                topologyUpdateErrors.push({ url, error });
                return false;
            }
        };

        const tryUpdateTopologyOnAllNodes = async () => {
            for (const url of initialUrls) {
                if (await tryUpdateTopology(url, this._databaseName)) {
                    return;
                }
            }

            return false;
        };

        await tryUpdateTopologyOnAllNodes();
        const topology = new Topology();
        topology.etag = this._topologyEtag;

        let topologyNodes = this.getTopologyNodes();
        if (!topologyNodes) {
            topologyNodes = initialUrls.map(url => {
                const serverNode = new ServerNode({
                    url,
                    database: this._databaseName
                });
                serverNode.clusterTag = "!";
                return serverNode;
            });
        }

        topology.nodes = topologyNodes;

        this._nodeSelector?.dispose();
        this._nodeSelector = new NodeSelector(topology);

        if (initialUrls && initialUrls.length > 0) {
            this._initializeUpdateTopologyTimer();
            return;
        }

        this._lastKnownUrls = initialUrls;
        const details: string = topologyUpdateErrors
            .map(x => `${x.url} -> ${x.error && (x.error as Error).stack ? (x.error as Error).stack : x.error}`)
            .join(", ");

        this._throwExceptions(details);
    }

    protected _throwExceptions(details: string): void {
        throwError("InvalidOperationException",
            "Failed to retrieve database topology from all known nodes"
            + EOL + details);
    }

    public static validateUrls(initialUrls: string[], authOptions: IAuthOptions) {
        const cleanUrls = new Array(initialUrls.length);
        let requireHttps = !!authOptions?.certificate;
        for (let index = 0; index < initialUrls.length; index++) {
            const url = initialUrls[index];
            validateUri(url);
            cleanUrls[index] = url.replace(/\/$/, "");
            requireHttps = requireHttps || url.startsWith("https://");
        }

        if (!requireHttps) {
            return cleanUrls;
        }

        for (const url of initialUrls) {
            if (!url.startsWith("http://")) {
                continue;
            }

            if (authOptions && authOptions.certificate) {
                throwError("InvalidOperationException",
                    "The url " + url + " is using HTTP, but a certificate is specified, which require us to use HTTPS");
            }

            throwError("InvalidOperationException",
                "The url " + url
                + " is using HTTP, but other urls are using HTTPS, and mixing of HTTP and HTTPS is not allowed.");
        }

        return cleanUrls;
    }

    private _initializeUpdateTopologyTimer(): void {
        if (this._updateTopologyTimer || this._disposed) {
            return;
        }

        this._log.info("Initialize update topology timer.");

        const minInMs = 60 * 1000;
        this._updateTopologyTimer =
            new Timer(() => this._updateTopologyCallback(), minInMs, minInMs);
    }

    private async _executeOnSpecificNode<TResult>( // this method is called `execute` in c# and java code
        command: RavenCommand<TResult>,
        sessionInfo: SessionInfo = null,
        options: ExecuteOptions<TResult> = null): Promise<void> {

        if (command.failoverTopologyEtag === RequestExecutor.INITIAL_TOPOLOGY_ETAG) {
            command.failoverTopologyEtag = RequestExecutor.INITIAL_TOPOLOGY_ETAG;

            if (this._nodeSelector && this._nodeSelector.getTopology()) {
                const topology = this._nodeSelector.getTopology();
                if (topology.etag) {
                    command.failoverTopologyEtag = topology.etag;
                }
            }
        }

        const { chosenNode, nodeIndex, shouldRetry } = options;

        this._log.info(`Actual execute ${command.constructor.name} on ${chosenNode.url}`
            + ` ${ shouldRetry ? "with" : "without" } retry.`);

        let url: string;
        const req = this._createRequest(chosenNode, command, u => url = u);

        const controller = new AbortController();

        if (options?.abortRef) {
            options.abortRef(controller);
        }

        req.signal = controller.signal;

        const noCaching = sessionInfo ? sessionInfo.noCaching : false;

        let cachedChangeVector: string;
        let cachedValue: string;
        const cachedItem = this._getFromCache(
            command, !noCaching, req.uri.toString(), (cachedItemMetadata) => {
                cachedChangeVector = cachedItemMetadata.changeVector;
                cachedValue = cachedItemMetadata.response;
            });


        if (cachedChangeVector) {
            if (await this._tryGetFromCache(command, cachedItem, cachedValue)) {
                return;
            }
        }

        this._setRequestHeaders(sessionInfo, cachedChangeVector, req);

        command.numberOfAttempts++;
        const attemptNum = command.numberOfAttempts;
        this._emitter.emit("beforeRequest", new BeforeRequestEventArgs(this._databaseName, url, req, attemptNum));

        const responseAndStream = await this._sendRequestToServer(chosenNode, nodeIndex, command, shouldRetry, sessionInfo, req, url, controller);

        if (!responseAndStream) {
            return;
        }


        const response = responseAndStream.response;
        const bodyStream = responseAndStream.bodyStream;
        const refreshTask = this._refreshIfNeeded(chosenNode, response);

        command.statusCode = response.status;

        let responseDispose: ResponseDisposeHandling = "Automatic";

        try {

            if (response.status === StatusCodes.NotModified) {
                this._emitter.emit("succeedRequest", new SucceedRequestEventArgs(this._databaseName, url, response, req, attemptNum));

                cachedItem.notModified();

                if (command.responseType === "Object") {
                    await command.setResponseFromCache(cachedValue);
                }

                return;
            }

            if (response.status >= 400) {
                const unsuccessfulResponseHandled = await this._handleUnsuccessfulResponse(
                    chosenNode,
                    nodeIndex,
                    command,
                    req,
                    response,
                    bodyStream,
                    req.uri as string,
                    sessionInfo,
                    shouldRetry);

                if (!unsuccessfulResponseHandled) {

                    const dbMissingHeader = response.headers.get(HEADERS.DATABASE_MISSING);
                    if (dbMissingHeader) {
                        throwError("DatabaseDoesNotExistException", dbMissingHeader as string);
                    }

                    this._throwFailedToContactAllNodes(command, req);
                }

                return; // we either handled this already in the unsuccessful response or we are throwing
            }

            this._emitter.emit("succeedRequest", new SucceedRequestEventArgs(this._databaseName, url, response, req, attemptNum));

            responseDispose = await command.processResponse(this._cache, response, bodyStream, req.uri as string);
            this._lastReturnedResponse = new Date();
        } finally {
            if (responseDispose === "Automatic") {
                closeHttpResponse(response);
            }

            await refreshTask;
        }
    }

    private async _refreshIfNeeded(chosenNode: ServerNode, response: HttpResponse) {
        const refreshTopology = response
            && response.headers
            && response.headers.get(HEADERS.REFRESH_TOPOLOGY);

        const refreshClientConfiguration = response
            && response.headers
            && response.headers.get(HEADERS.REFRESH_CLIENT_CONFIGURATION);

        const tasks: Promise<any>[] = [];

        if (refreshTopology) {
            const updateParameters = new UpdateTopologyParameters(chosenNode);
            updateParameters.timeoutInMs = 0;
            updateParameters.debugTag = "refresh-topology-header";
            tasks.push(this.updateTopology(updateParameters));
        }

        if (refreshClientConfiguration) {
            tasks.push(this._updateClientConfiguration(chosenNode));
        }

        await Promise.all(tasks);
    }

    private async _sendRequestToServer<TResult>(chosenNode: ServerNode,
                                                nodeIndex: number,
                                                command: RavenCommand<TResult>,
                                                shouldRetry: boolean,
                                                sessionInfo: SessionInfo,
                                                request: HttpRequestParameters,
                                                url: string,
                                                abortController: AbortController) {
        try {
            this.numberOfServerRequests++;

            const timeout = command.timeout || this._defaultTimeout;

            if (!TypeUtil.isNullOrUndefined(timeout)) {
                const cancelTask = setTimeout(() => abortController.abort(), timeout);

                try {
                    return await this._send(chosenNode, command, sessionInfo, request);
                } catch (error) {
                    if (error.name === "AbortError") {
                        const timeoutException = getError("TimeoutException", "The request for " + request.uri + " failed with timeout after " + TimeUtil.millisToTimeSpan(timeout), error);
                        if (!shouldRetry) {
                            if (!command.failedNodes) {
                                command.failedNodes = new Map<ServerNode, Error>();
                            }

                            command.failedNodes.set(chosenNode, timeoutException);
                            throw timeoutException;
                        }

                        if (!await this._handleServerDown(url, chosenNode, nodeIndex, command, request, null,  "", timeoutException, sessionInfo, shouldRetry)) {
                            this._throwFailedToContactAllNodes(command, request);
                        }
                        return null;
                    }
                    throw error;
                } finally {
                    clearTimeout(cancelTask);
                }
            } else {
                return await this._send(chosenNode, command, sessionInfo, request);
            }
        } catch (e) {
            if (e.name === "AllTopologyNodesDownException") {
                throw e;
            }

            if (e?.cause?.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
                if (chosenNode.url.startsWith("https://") && !this.getAuthOptions()?.certificate) {
                    throwError("AuthorizationException", "This server requires client certificate for authentication, but none was provided by the client.", e);
                }
            }

            // node.js fetch doesn't even send request to server is expected protocol is different from actual,
            // so we need handle this case differently
            // https://github.com/nodejs/node/blob/d8c4e375f21b8475d3b717d1d1120ad4eabf8f63/lib/_http_client.js#L157

            if (e.code === "ERR_INVALID_PROTOCOL") {
                if (chosenNode.url.startsWith("https://") && !this.getAuthOptions()?.certificate) {
                    throwError("AuthorizationException", "This server requires client certificate for authentication, but none was provided by the client.", e);
                }

                throwError("AuthorizationException", "Invalid protocol", e);
            }

            if (!shouldRetry) {
                throw e;
            }

            if (!await this._handleServerDown(url, chosenNode, nodeIndex, command, request, null, "", e, sessionInfo, shouldRetry)) {
                this._throwFailedToContactAllNodes(command, request);
            }

            return null;
        }
    }

    private async _send<TResult>(chosenNode: ServerNode, command: RavenCommand<TResult>, sessionInfo: SessionInfo, request: HttpRequestParameters): Promise<{ response: HttpResponse, bodyStream: Readable }> {
        let responseAndStream: { response: HttpResponse, bodyStream: Readable };

        if (this._shouldExecuteOnAll(chosenNode, command)) {
            responseAndStream = await this._executeOnAllToFigureOutTheFastest(chosenNode, command);
        } else {
            responseAndStream = await command.send(await this.getHttpAgent(), request);
        }

        // PERF: The reason to avoid rechecking every time is that servers wont change so rapidly
        //       and therefore we dimish its cost by orders of magnitude just doing it
        //       once in a while. We dont care also about the potential race conditions that may happen
        //       here mainly because the idea is to have a lax mechanism to recheck that is at least
        //       orders of magnitude faster than currently.
        if (chosenNode.shouldUpdateServerVersion()) {
            const serverVersion = RequestExecutor._tryGetServerVersion(responseAndStream.response);
            if (serverVersion) {
                chosenNode.updateServerVersion(serverVersion);
            }
        }

        this._lastServerVersion = chosenNode.lastServerVersion;

        if (sessionInfo && sessionInfo.lastClusterTransactionIndex) {
            // if we reach here it means that sometime a cluster transaction has occurred against this database.
            // Since the current executed command can be dependent on that,
            // we have to wait for the cluster transaction.
            // But we can't do that if the server is an old one.

            if (this._lastServerVersion && "4.1".localeCompare(this._lastServerVersion) > 0) {
                throwError(
                    "ClientVersionMismatchException",
                    "The server on " + chosenNode.url + " has an old version and can't perform "
                    + "the command since this command dependent on a cluster transaction "
                    + " which this node doesn't support.");
            }
        }

        return responseAndStream;
    }


    private _setRequestHeaders(sessionInfo: SessionInfo, cachedChangeVector: string, req: HttpRequestParameters) {
        if (cachedChangeVector) {
            req.headers[HEADERS.IF_NONE_MATCH] = `"${cachedChangeVector}"`;
        }

        if (!this._disableClientConfigurationUpdates) {
            req.headers[HEADERS.CLIENT_CONFIGURATION_ETAG] = this._clientConfigurationEtag;
        }
        if (sessionInfo && sessionInfo.lastClusterTransactionIndex) {
            req.headers[HEADERS.LAST_KNOWN_CLUSTER_TRANSACTION_INDEX] =
                sessionInfo.lastClusterTransactionIndex;
        }

        if (!this._disableTopologyUpdates) {
            req.headers[this._topologyHeaderName] = `"${this._topologyEtag}"`;
        }

        if (!req.headers[HEADERS.CLIENT_VERSION]) {
            req.headers[HEADERS.CLIENT_VERSION] = RequestExecutor.CLIENT_VERSION;
        }
    }

    private async _tryGetFromCache<TResult>(command: RavenCommand<TResult>, cachedItem: ReleaseCacheItem, cachedValue: string): Promise<boolean> {
        const aggressiveCacheOptions = this.aggressiveCaching;
        if (aggressiveCacheOptions
            && cachedItem.age < aggressiveCacheOptions.duration
            && !cachedItem.mightHaveBeenModified
            && command.canCacheAggressively) {
            if (cachedItem.item.flags === "NotFound") {
                // if this is a cached delete, we only respect it if it _came_ from an aggressively cached
                // block, otherwise, we'll run the request again

                return false;
            } else {
                await command.setResponseFromCache(cachedValue);
                return true;
            }
        }

        return false;
    }

    private static _tryGetServerVersion(response: HttpResponse) {
        return response.headers.get(HEADERS.SERVER_VERSION);
    }

    private _throwFailedToContactAllNodes<TResult>(
        command: RavenCommand<TResult>,
        req: HttpRequestParameters) {

        if (!command.failedNodes || !command.failedNodes.size) { //precaution, should never happen at this point
            throwError("InvalidOperationException", "Received unsuccessful response and couldn't recover from it. " +
                "Also, no record of exceptions per failed nodes. This is weird and should not happen.");
        }

        if (command.failedNodes.size === 1) {
            throw Array.from(command.failedNodes.values())[0];
        }

        let message: string = "Tried to send "
            + command.constructor.name
            + " request via "
            + (req.method || "GET") + " "
            + req.uri + " to all configured nodes in the topology, "
            + "none of the attempt succeeded." + EOL;

        if (this._topologyTakenFromNode) {
            message += "I was able to fetch " + this._topologyTakenFromNode.database
                + " topology from " + this._topologyTakenFromNode.url + "." + EOL;
        }

        let nodes: ServerNode[];
        if (this._nodeSelector && this._nodeSelector.getTopology()) {
            nodes = this._nodeSelector.getTopology().nodes;
        }

        if (!nodes) {
            message += "Topology is empty.";
        } else {
            message += "Topology: ";

            for (const node of nodes) {
                const error = command.failedNodes.get(node);

                message += EOL +
                    "[Url: " + node.url + ", " +
                    "ClusterTag: " + node.clusterTag + ", " +
                    "ServerRole: " + node.serverRole + ", " +
                    "Exception: " + (error ? error.message : "No exception") + "]";
            }
        }

        throwError("AllTopologyNodesDownException", message);
    }

    public inSpeedTestPhase() {
        return this._nodeSelector
            && this._nodeSelector.inSpeedTestPhase();
    }

    private _shouldExecuteOnAll<TResult>(chosenNode: ServerNode, command: RavenCommand<TResult>): boolean {
        return this.conventions.readBalanceBehavior === "FastestNode" &&
            this._nodeSelector &&
            this._nodeSelector.inSpeedTestPhase() &&
            this._nodeSelectorHasMultipleNodes() &&
            command.isReadRequest &&
            command.responseType === "Object" &&
            !!chosenNode &&
            !(command["prepareToBroadcast"]); // duck typing: !(command instanceof IBroadcast)
    }

    private async _executeOnAllToFigureOutTheFastest<TResult>(
        chosenNode: ServerNode,
        command: RavenCommand<TResult>): Promise<{ response: HttpResponse, bodyStream: Readable }> {
        let preferredTask: Promise<IndexAndResponse> = null;

        const nodes = this._nodeSelector.getTopology().nodes;
        const tasks: Promise<IndexAndResponse>[] = nodes.map(x => null);

        let task: Promise<IndexAndResponse>;
        for (let i = 0; i < nodes.length; i++) {
            const taskNumber = i;
            this.numberOfServerRequests++;

            const agent = await this.getHttpAgent();

            task = Promise.resolve()
                .then(() => {
                    const req = this._createRequest(nodes[taskNumber], command, TypeUtil.NOOP);
                    if (!req) {
                        return;
                    }
                    this._setRequestHeaders(null, null, req);
                    return command.send(agent, req);
                })
                .then(commandResult => new IndexAndResponse(taskNumber, commandResult.response, commandResult.bodyStream))
                .catch(err => {
                    tasks[taskNumber] = null;
                    throw err;
                });

            if (nodes[i].clusterTag === chosenNode.clusterTag) {
                preferredTask = task;
            }

            tasks[i] = task;
        }

        const result = raceToResolution(tasks)
            .then(fastest => {
                this._nodeSelector.recordFastest(fastest.index, nodes[fastest.index]);
            })
            .catch((err) => {
                this._log.warn(err, "Error executing on all to find fastest node.");
            })
            .then(() => preferredTask);

        return Promise.resolve(result);
    }

    private _getFromCache<TResult>(
        command: RavenCommand<TResult>,
        useCache: boolean,
        url: string,
        cachedItemMetadataCallback: (data: CachedItemMetadata) => void) {

        if (useCache
            && command.canCache
            && command.isReadRequest
            && command.responseType === "Object") {
            return this._cache.get(url, cachedItemMetadataCallback);
        }

        cachedItemMetadataCallback({
            changeVector: null,
            response: null
        });

        return new ReleaseCacheItem(null);
    }


    private _nodeSelectorHasMultipleNodes() {
        const selector = this._nodeSelector;
        if (!selector) {
            return false;
        }
        const topology = selector.getTopology();
        return topology && topology.nodes && topology.nodes.length > 1;
    }


    private _createRequest<TResult>(node: ServerNode, command: RavenCommand<TResult>, urlRef: (value: string) => void): HttpRequestParameters {
        const request = command.createRequest(node);

        if (!request) {
            return null;
        }

        if (this.conventions.customFetch) {
            request.fetcher = this.conventions.customFetch;
        }

        const req = Object.assign(request, this._defaultRequestOptions);
        urlRef(req.uri);
        req.headers = req.headers || {};

        let builder = new URL(req.uri);

        if (RequestExecutor.requestPostProcessor) {
            RequestExecutor.requestPostProcessor(req);
        }

        if (command["getRaftUniqueRequestId"]) {
            const raftCommand = command as unknown as IRaftCommand;

            const raftRequestString = "raft-request-id=" + raftCommand.getRaftUniqueRequestId();

            let joinCharacter = builder.search ? "&" : "?";
            if (!builder.search && req.uri.endsWith("?")) {
                joinCharacter = "";
            }

            builder = new URL(builder.toString() + joinCharacter + raftRequestString);
        }

        if (this._shouldBroadcast(command)) {
            command.timeout = command.timeout ?? this.firstBroadcastAttemptTimeout;
        }

        req.uri = builder.toString();

        return req;
    }

    private async _handleUnsuccessfulResponse<TResult>(
        chosenNode: ServerNode,
        nodeIndex: number,
        command: RavenCommand<TResult>,
        req: HttpRequestParameters,
        response: HttpResponse,
        responseBodyStream: Readable,
        url: string,
        sessionInfo: SessionInfo,
        shouldRetry: boolean): Promise<boolean> {
        responseBodyStream.resume();
        const readBody = () => readToEnd(responseBodyStream);
        switch (response.status) {
            case StatusCodes.NotFound: {
                this._cache.setNotFound(url);
                switch (command.responseType) {
                    case "Empty": {
                        return true;
                    }
                    case "Object": {
                        return command.setResponseAsync(null, false)
                            .then(() => true);
                    }
                    default: {
                        command.setResponseRaw(response, null);
                        break;
                    }
                }
                return true;
            }

            case StatusCodes.Forbidden: {
                const msg = await readBody();
                throwError("AuthorizationException",
                    `Forbidden access to ${chosenNode.database}@${chosenNode.url}`
                    + `, ${req.method || "GET"} ${req.uri}` + EOL + msg);
                break;
            }
            case StatusCodes.Gone: {
                // request not relevant for the chosen node - the database has been moved to a different one
                if (!shouldRetry) {
                    return false;
                }

                if (nodeIndex != null) {
                    this._nodeSelector.onFailedRequest(nodeIndex);
                }

                if (!command.failedNodes) {
                    command.failedNodes = new Map();
                }

                if (command.isFailedWithNode(chosenNode)) {
                    command.failedNodes.set(chosenNode, getError("UnsuccessfulRequestException",
                        "Request to " + url + "(" + req.method + ") is not relevant for this node anymore."));
                }

                let indexAndNode = this.chooseNodeForRequest(command, sessionInfo);

                if (command.failedNodes.has(indexAndNode.currentNode)) {
                    // we tried all the nodes, let's try to update topology and retry one more time
                    const updateParameters = new UpdateTopologyParameters(chosenNode);
                    updateParameters.timeoutInMs = 60_000;
                    updateParameters.debugTag = "handle-unsuccessful-response";
                    const success = await this.updateTopology(updateParameters);
                    if (!success) {
                        return false;
                    }

                    command.failedNodes.clear(); // we just update the topology
                    indexAndNode = this.chooseNodeForRequest(command, sessionInfo);

                    await this._executeOnSpecificNode(command, sessionInfo, {
                        chosenNode: indexAndNode.currentNode,
                        nodeIndex: indexAndNode.currentIndex,
                        shouldRetry: false
                    });
                    return true;
                }

                await this._executeOnSpecificNode(command, sessionInfo, {
                    chosenNode: indexAndNode.currentNode,
                    nodeIndex: indexAndNode.currentIndex,
                    shouldRetry: false
                });
                return true;
            }
            case StatusCodes.GatewayTimeout:
            case StatusCodes.RequestTimeout:
            case StatusCodes.BadGateway:
            case StatusCodes.ServiceUnavailable: {
                return this._handleServerDown(
                    url, chosenNode, nodeIndex, command, req, response, await readBody(), null, sessionInfo, shouldRetry);
            }
            case StatusCodes.Conflict: {
                RequestExecutor._handleConflict(response, await readBody());
                break;
            }
            case StatusCodes.TooEarly: {
                if (!shouldRetry) {
                    return false;
                }

                if (!TypeUtil.isNullOrUndefined(nodeIndex)) {
                    this._nodeSelector.onFailedRequest(nodeIndex);
                }

                command.failedNodes ??= new Map<ServerNode, Error>();

                if (!command.isFailedWithNode(chosenNode)) {
                    command.failedNodes.set(chosenNode, getError("UnsuccessfulRequestException", "Request to '" + req.uri + "' (" + req.method + ") is processing and not yet available on that node."));
                }

                const nextNode = this.chooseNodeForRequest(command, sessionInfo);

                await this._executeOnSpecificNode(command, sessionInfo, {
                    chosenNode: nextNode.currentNode,
                    nodeIndex: nextNode.currentIndex,
                    shouldRetry: true
                });

                this._nodeSelector.restoreNodeIndex(chosenNode);

                return true;
            }
            default: {
                command.onResponseFailure(response);
                ExceptionDispatcher.throwException(response, await readBody());
            }
        }
    }

    private static _handleConflict(response: HttpResponse, body: string): void {
        ExceptionDispatcher.throwException(response, body);
    }

    private async _handleServerDown<TResult>(
        url: string,
        chosenNode: ServerNode,
        nodeIndex: number,
        command: RavenCommand<TResult>,
        req: HttpRequestParameters,
        response: HttpResponse,
        body: string,
        error: any,
        sessionInfo: SessionInfo,
        shouldRetry: boolean): Promise<boolean> {

        if (!command.failedNodes) {
            command.failedNodes = new Map();
        }

        const exception = RequestExecutor._readExceptionFromServer(req, response, body, error);
        if (exception.name === "RavenTimeoutException" && (exception as any).failImmediately) {
            throw exception;
        }
        command.failedNodes.set(chosenNode, exception);

        if (nodeIndex === null) {
            return false;
        }

        if (!this._nodeSelector) {
            this._spawnHealthChecks(chosenNode, nodeIndex);
            return false;
        }

        // As the server is down, we discard the server version to ensure we update when it goes up.
        chosenNode.discardServerVersion();

        this._nodeSelector.onFailedRequest(nodeIndex);

        if (this._shouldBroadcast(command)) {
            command.result = await this._broadcast(command, sessionInfo);
            return true;
        }

        this._spawnHealthChecks(chosenNode, nodeIndex);


        const currentIndexAndNode = this.chooseNodeForRequest(command, sessionInfo);
        const topologyEtag = this._nodeSelector.getTopology()?.etag ?? -2;

        if (command.failoverTopologyEtag !== this._topologyEtag) {
            command.failedNodes.clear();
            command.failoverTopologyEtag = this._topologyEtag;
        }

        if (command.failedNodes.has(currentIndexAndNode.currentNode)) {
            return false;
        }

        this._onFailedRequestInvoke(url, error, req, response);

        await this._executeOnSpecificNode(command, sessionInfo, {
            chosenNode: currentIndexAndNode.currentNode,
            nodeIndex: currentIndexAndNode.currentIndex,
            shouldRetry
        });

        return true;
    }

    private _shouldBroadcast<TResult>(command: RavenCommand<TResult>) {
        if (!command["prepareToBroadcast"]) {
            return false;
        }

        const topologyNodes = this.getTopologyNodes();
        if (!topologyNodes || topologyNodes.length < 2) {
            return false;
        }

        return true;
    }

    private async _broadcast<TResult>(command: RavenCommand<TResult>, sessionInfo: SessionInfo) {
        if (!command["prepareToBroadcast"]) {
            throwError("InvalidOperationException", "You can broadcast only commands that implement 'IBroadcast'.");
        }

        const broadcastCommand = command as unknown as IBroadcast;
        const failedNodes = command.failedNodes;

        command.failedNodes = new Map<ServerNode, Error>(); // clean the current failures

        const broadcastTasks = new Map<Promise<number>, BroadcastState<TResult>>();

        try {
            this._sendToAllNodes(broadcastTasks, sessionInfo, broadcastCommand);

            return this._waitForBroadcastResult(command, broadcastTasks);
        } finally {
            for (const broadcastState of Array.from(broadcastTasks.entries())) {
                const task = broadcastState[0];
                if (task) {
                    task.catch(throwable => {
                        const index = broadcastState[1].index;
                        const node = this._nodeSelector.getTopology().nodes[index];
                        if (failedNodes.has(node)) {
                            // if other node succeed in broadcast we need to send health checks to the original failed node
                            this._spawnHealthChecks(node, index);
                        }
                    });
                }
            }
        }
    }

    private async _waitForBroadcastResult<TResult>(command: RavenCommand<TResult>, tasks: Map<Promise<number>, BroadcastState<TResult>>): Promise<TResult> {
        while (tasks.size) {
            let error: Error;
            try {
                const completed = await Promise.race(Array.from(tasks.keys()));

                for (const state of Array.from(tasks.values())) {
                    state.abort?.abort();
                }

                const completedItem = Array.from(tasks.values()).find(x => x.index === completed);

                this._nodeSelector.restoreNodeIndex(completedItem.node);
                return completedItem.command.result;
            } catch (e) {
                error = e.error;
                const failedIndex = e.index;

                const failedPair = Array.from(tasks.entries())
                    .find(x => x[1].index === failedIndex);
                const node = this._nodeSelector.getTopology().nodes[failedIndex];

                command.failedNodes.set(node, error);

                this._nodeSelector.onFailedRequest(failedIndex);
                this._spawnHealthChecks(node, failedIndex);

                tasks.delete(failedPair[0]);
            }
        }

        const exceptions = Array.from(command.failedNodes
            .entries())
            .map(x => x[0].url + ": " + x[1].message)
            .join(", ");

        throwError("AllTopologyNodesDownException", "Broadcasting " + command.constructor.name + " failed: " + exceptions);
    }

    private _sendToAllNodes<TResult>(tasks: Map<Promise<number>, BroadcastState<TResult>>, sessionInfo: SessionInfo, command: IBroadcast) {
        for (let index = 0; index < this._nodeSelector.getTopology().nodes.length; index++) {
            const state = new BroadcastState<TResult>();
            state.command = command.prepareToBroadcast(this.conventions) as unknown as RavenCommand<TResult>;
            state.index = index;
            state.node = this._nodeSelector.getTopology().nodes[index];

            state.command.timeout = this.secondBroadcastAttemptTimeout;

            let abortController: AbortController;
            const task: Promise<number> = this.execute(state.command, sessionInfo, {
                chosenNode: state.node,
                nodeIndex: null,
                shouldRetry: false,
                abortRef: a => abortController = a
            })
                .then(() => index)
                .catch(e => {
                    throw {
                        index,
                        error: e
                    };
                })

            state.abort = abortController;
            tasks.set(task, state);
        }
    }

    public async handleServerNotResponsive(url: string, chosenNode: ServerNode, nodeIndex: number, e: Error) {
        this._spawnHealthChecks(chosenNode, nodeIndex);
        if (this._nodeSelector) {
            this._nodeSelector.onFailedRequest(nodeIndex);
        }

        const preferredNode = await this.getPreferredNode();

        if (this._disableTopologyUpdates) {
            await this._performHealthCheck(chosenNode, nodeIndex);
        } else {
            const updateParameters = new UpdateTopologyParameters(preferredNode.currentNode);
            updateParameters.timeoutInMs = 0;
            updateParameters.forceUpdate = true;
            updateParameters.debugTag = "handle-server-not-responsive";

            await this.updateTopology(updateParameters);
        }

        this._onFailedRequestInvoke(url, e);

        return preferredNode.currentNode;
    }

    private _spawnHealthChecks(chosenNode: ServerNode, nodeIndex: number): void {
        if (this._disposed) {
            return;
        }

        if (this._nodeSelector && this._nodeSelector.getTopology().nodes.length < 2) {
            return;
        }

        if (this._failedNodesTimers.has(chosenNode)) {
            return;
        }

        this._log.info(`Spawn health checks for node ${chosenNode.url}.`);

        const nodeStatus: NodeStatus = new NodeStatus(
            nodeIndex,
            chosenNode,
            this,
            (nStatus: NodeStatus) => this._checkNodeStatusCallback(nStatus));
        this._failedNodesTimers.set(chosenNode, nodeStatus);
        nodeStatus.startTimer();
    }

    private _checkNodeStatusCallback(nodeStatus: NodeStatus): Promise<void> {
        // In some cases, race conditions may occur with a recently changed topology and a failed node.
        // We still should check the node's health, and if healthy, remove its timer and restore its index.

        let nodeIndex: number;
        let serverNode: ServerNode;
        let status: NodeStatus;

        try {
            const nodeIndexAndServerNode = this._nodeSelector.getRequestedNode(nodeStatus.node.clusterTag)
            nodeIndex = nodeIndexAndServerNode.currentIndex;
            serverNode = nodeIndexAndServerNode.currentNode;
        } catch (e) {
            // There are no nodes in the topology or could not find requested node. Nothing we can do here
            if (e.name === "DatabaseDoesNotExistException" || e.name === "RequestedNodeUnavailableException") {
                status = this._failedNodesTimers.get(nodeStatus.node);
                if (status) {
                    status.dispose();
                }

                return;
            } else {
                throw e;
            }
        }

        if (!serverNode) {
            return;
        }

        return Promise.resolve()
            .then(() => {
                return Promise.resolve(this._performHealthCheck(serverNode, nodeIndex))
                    .then(() => {
                            status = this._failedNodesTimers[nodeStatus.nodeIndex];
                            if (status) {
                                this._failedNodesTimers.delete(nodeStatus.node);
                                status.dispose();
                            }

                            if (this._nodeSelector) {
                                this._nodeSelector.restoreNodeIndex(serverNode);
                            }
                        },
                        err => {
                            this._log.error(err, `${serverNode.clusterTag} is still down`);

                            status = this._failedNodesTimers.get(nodeStatus.node);
                            if (status) {
                                nodeStatus.updateTimer();
                            }
                        });
            })
            .catch(err => {
                this._log.error(
                    err, "Failed to check node topology, will ignore this node until next topology update.");
            });
    }

    protected async _performHealthCheck(serverNode: ServerNode, nodeIndex: number): Promise<void> {
        try {
            if (!RequestExecutor._useOldFailureCheckOperation.has(serverNode.url)) {
                await this._executeOnSpecificNode(
                    RequestExecutor._failureCheckOperation.getCommand(this._conventions),
                    null,
                    {
                        chosenNode: serverNode,
                        nodeIndex,
                        shouldRetry: false,
                    });
            } else {
                await this._executeOldHealthCheck(serverNode, nodeIndex);
            }
        } catch (e) {
            if (e.message.includes("RouteNotFoundException")) {
                RequestExecutor._useOldFailureCheckOperation.add(serverNode.url);
                await this._executeOldHealthCheck(serverNode, nodeIndex);
                return ;
            }

            throw e;
        }
    }

    private _executeOldHealthCheck(serverNode: ServerNode, nodeIndex: number) {
        return this._executeOnSpecificNode(
            RequestExecutor._backwardCompatibilityFailureCheckOperation.getCommand(this._conventions),
            null,
            {
                chosenNode: serverNode,
                nodeIndex,
                shouldRetry: false,
            });
    }

    private static _readExceptionFromServer<TResult>(
        req: HttpRequestParameters,
        response: HttpResponse,
        body: string,
        e: Error): Error {

        if (response && body) {
            const responseJson: string = body;
            try {
                const resExceptionSchema = JsonSerializer
                    .getDefaultForCommandPayload()
                    .deserialize<ExceptionSchema>(responseJson);
                return ExceptionDispatcher.get(resExceptionSchema, response.status, e);
            } catch (__) {
                log.warn(__, "Error parsing server error.");
                const unrecognizedErrSchema = {
                    url: req.uri as string,
                    message: "Unrecognized response from the server",
                    error: responseJson,
                    type: "Unparsable Server Response"
                };

                return ExceptionDispatcher.get(unrecognizedErrSchema, response.status, e);
            }
        }

        const exceptionSchema = {
            url: req.uri.toString(),
            message: e.message,
            error: `An exception occurred while contacting ${ req.uri }: ${ e.message } . ${ EOL + e.stack }`,
            type: e.name
        };

        return ExceptionDispatcher.get(exceptionSchema, StatusCodes.ServiceUnavailable, e);
    }


    private _setDefaultRequestOptions(): void {
        this._defaultRequestOptions = Object.assign(
            DEFAULT_REQUEST_OPTIONS,
            {
                compress: !(this._conventions.hasExplicitlySetCompressionUsage && !this._conventions.useCompression)
            },
            this._customHttpRequestOptions);
    }

    public dispose(): void {
        this._log.info("Dispose.");

        if (this._disposed) {
            return;
        }

        this._disposed = true;

        this._updateClientConfigurationSemaphore.take(TypeUtil.NOOP);

        this._updateDatabaseTopologySemaphore.take(TypeUtil.NOOP);

        this._cache.dispose();

        if (this._updateTopologyTimer) {
            this._updateTopologyTimer.dispose();
        }
        this._nodeSelector?.dispose();

        this._disposeAllFailedNodesTimers();
    }

    public async getRequestedNode(nodeTag: string, throwIfContainsFailures = false): Promise<CurrentIndexAndNode> {
        await this._ensureNodeSelector();

        const currentIndexAndNode = this._nodeSelector.getRequestedNode(nodeTag);

        if (throwIfContainsFailures && !this._nodeSelector.nodeIsAvailable(currentIndexAndNode.currentIndex)) {
            throwError("RequestedNodeUnavailableException", "Requested node " + nodeTag + " currently unavailable, please try again later.");
        }

        return currentIndexAndNode;
    }

    public async getPreferredNode(): Promise<CurrentIndexAndNode> {
        await this._ensureNodeSelector();
        return this._nodeSelector.getPreferredNode();
    }

    public async getNodeBySessionId(sessionId: number): Promise<CurrentIndexAndNode> {
        await this._ensureNodeSelector();
        return this._nodeSelector.getNodeBySessionId(sessionId);
    }

    public async getFastestNode(): Promise<CurrentIndexAndNode> {
        await this._ensureNodeSelector();
        return this._nodeSelector.getFastestNode();
    }

    private async _ensureNodeSelector(): Promise<void> {
        if (!this._disableTopologyUpdates) {
            await this._waitForTopologyUpdate(this.firstTopologyUpdatePromise);
        }

        if (!this._nodeSelector) {
            const topology = new Topology(this._topologyEtag, this.getTopologyNodes().slice());
            this._nodeSelector = new NodeSelector(topology);
        }
    }

    protected _onTopologyUpdatedInvoke(newTopology: Topology) {
        this._emitter.emit("topologyUpdated", new TopologyUpdatedEventArgs(newTopology));
    }
}

class BroadcastState<TResult> {
    public command: RavenCommand<TResult>;
    public index: number;
    public node: ServerNode;
    public abort: AbortController;
}
