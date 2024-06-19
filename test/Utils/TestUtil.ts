import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { RavenTestDriver } from "../TestDriver/index.js";
import { RavenServerLocator } from "../TestDriver/RavenServerLocator.js";
import { getError, throwError } from "../../src/Exceptions/index.js";
import os from "node:os";
import {
    CreateDatabaseOperation,
    DatabaseRecord,
    DeleteDatabasesOperation,
    DocumentConventions,
    DocumentSession,
    DocumentStore,
    DocumentType,
    getAllNodesFromTopology,
    GetClusterTopologyCommand,
    GetDatabaseRecordOperation,
    IDocumentSession,
    ServerNode,
    IDisposable,
    IDocumentStore,
    IAuthOptions
} from "../../src/index.js";
import { sync } from "rimraf";
import { ChildProcess } from "node:child_process";
import { TypeUtil } from "../../src/Utility/TypeUtil.js";
import { getLogger } from "../../src/Utility/LogUtil.js";
import { AdminJsConsoleOperation } from "./AdminJsConsoleOperation.js";
import { Stopwatch } from "../../src/Utility/Stopwatch.js";
import { delay, wrapWithTimeout } from "../../src/Utility/PromiseUtil.js";
import moment from "moment";
import { INDEXES } from "../../src/Constants.js";

const log = getLogger({ module: "TestDriver" });

// logOnUncaughtAndUnhandled();

function logOnUncaughtAndUnhandled() {
    process.on("unhandledRejection", (...args) => {
        // eslint-disable-next-line no-console
        console.log(...args);
    });

    process.on("uncaughtException", (...args) => {
        // eslint-disable-next-line no-console
        console.log(...args);
    });
}

class TestServiceLocator extends RavenServerLocator {
    public getCommandArguments() {
        const cliOpts = [
            "--ServerUrl=http://127.0.0.1:0",
            "--ServerUrl.Tcp=tcp://127.0.0.1:38884",
            "--Features.Availability=Experimental"
        ];

        return cliOpts;
    }
}

class TestSecuredServiceLocator extends RavenServerLocator {
    public static ENV_SERVER_CA_PATH = "RAVENDB_TEST_CA_PATH";

    public static ENV_SERVER_CERTIFICATE_PATH = "RAVENDB_TEST_SERVER_CERTIFICATE_PATH";
    public static ENV_HTTPS_SERVER_URL = "RAVENDB_TEST_HTTPS_SERVER_URL";

    public static ENV_CLIENT_CERT_PATH = "RAVENDB_TEST_CLIENT_CERT_PATH";
    public static ENV_CLIENT_CERT_PASSPHRASE = "RAVENDB_TEST_CLIENT_CERT_PASSPHRASE";

    public getCommandArguments() {
        const certPath = this.getServerCertificatePath();
        if (!certPath) {
            throwError("InvalidOperationException", "Unable to find RavenDB server certificate path. " +
                "Please make sure " + TestSecuredServiceLocator.ENV_SERVER_CERTIFICATE_PATH
                + " environment variable is set and valid " + "(current value = " + certPath + ")");
        }

        return [
            "--Security.Certificate.Path=" + certPath,
            "--ServerUrl=" + this._getHttpsServerUrl(),
            "--ServerUrl.Tcp=" + this._getHttpsServerTcpUrl(),
            "--Features.Availability=Experimental"
        ];
    }

    private _getHttpsServerUrl() {
        const httpsServerUrl = process.env[TestSecuredServiceLocator.ENV_HTTPS_SERVER_URL];
        if (!httpsServerUrl) {
            throwError("InvalidArgumentException",
                "Unable to find RavenDB https server url. " +
                "Please make sure " + TestSecuredServiceLocator.ENV_HTTPS_SERVER_URL
                + " environment variable is set and is valid " +
                "(current value = " + httpsServerUrl + ")");
        }

        return httpsServerUrl;
    }

    private _getHttpsServerTcpUrl() {
        const https = this._getHttpsServerUrl();
        return "tcp://" + url.parse(https).hostname + ":38882";
    }

    public getServerCertificatePath() {
        const certPath = process.env[TestSecuredServiceLocator.ENV_SERVER_CERTIFICATE_PATH];
        if (!certPath) {
            throwError("InvalidArgumentException", TestSecuredServiceLocator.ENV_SERVER_CERTIFICATE_PATH + " env variable is missing");
        }
        return path.resolve(certPath);
    }

    public getClientAuthOptions(): IAuthOptions {
        const clientCertPath = process.env[TestSecuredServiceLocator.ENV_CLIENT_CERT_PATH];
        const clientCertPass = process.env[TestSecuredServiceLocator.ENV_CLIENT_CERT_PASSPHRASE];

        const serverCaCertPath = process.env[TestSecuredServiceLocator.ENV_SERVER_CA_PATH];

        if (!clientCertPath) {
            return {
                certificate: fs.readFileSync(this.getServerCertificatePath()),
                type: "pfx",
                ca: serverCaCertPath ? fs.readFileSync(serverCaCertPath, "utf8") : undefined
            };
        }

        return {
            type: "pem",
            certificate: fs.readFileSync(clientCertPath, "utf8"),
            password: clientCertPass,
            ca: fs.readFileSync(serverCaCertPath, "utf8"),
        };
    }
}

export class RavenTestContext extends RavenTestDriver implements IDisposable {

    public static isPullRequest = !process.env["RAVEN_License"];

    private readonly _locator: RavenServerLocator;
    private readonly _securedLocator: RavenServerLocator;

    private static _globalServer: IDocumentStore;
    private static _globalServerProcess: ChildProcess;

    private static _globalSecuredServer: IDocumentStore;
    private static _globalSecuredServerProcess: ChildProcess;

    private _documentStores: Set<IDocumentStore> = new Set();

    private static _index: number = 0;

    public constructor() {
        super();
        this._locator = new TestServiceLocator();
        this._securedLocator = new TestSecuredServiceLocator();
    }

    private _customizeDbRecord: (dbRecord: DatabaseRecord) => void = TypeUtil.NOOP;
    private _customizeStore: (store: DocumentStore) => Promise<void> = TypeUtil.ASYNC_NOOP;

    public set customizeDbRecord(customizeDbRecord: (dbRecord: DatabaseRecord) => void) {
        this._customizeDbRecord = customizeDbRecord;
    }

    public get customizeDbRecord() {
        return this._customizeDbRecord;
    }

    public set customizeStore(customizeStore: (store: DocumentStore) => Promise<void>) {
        this._customizeStore = customizeStore;
    }

    public get customizeStore() {
        return this._customizeStore;
    }

    public getSecuredDocumentStore(): Promise<DocumentStore>;
    public getSecuredDocumentStore(database?): Promise<DocumentStore> {
        return this.getDocumentStore(database, true, null);
    }

    private async _runServer(secured: boolean) {
        let childProcess: ChildProcess;

        const store = await this._runServerInternal(this._getLocator(secured), p => childProcess = p, s => {
            if (secured) {
                s.authOptions = this._securedLocator.getClientAuthOptions();
            }
        });

        RavenTestContext._setGlobalServerProcess(secured, childProcess);

        if (secured) {
            RavenTestContext._globalSecuredServer = store;
        } else {
            RavenTestContext._globalServer = store;
        }

        return store;
    }

    private _getLocator(secured: boolean) {
        return secured ? this._securedLocator : this._locator;
    }

    private static _getGlobalServer(secured: boolean) {
        return secured ? this._globalSecuredServer : this._globalServer;
    }

    private static _getGlobalProcess(secured: boolean) {
        return secured ? this._globalSecuredServerProcess : this._globalServerProcess;
    }

    private static _setGlobalServerProcess(secured: boolean, p: ChildProcess) {
        if (secured) {
            this._globalSecuredServerProcess = p;
        } else {
            this._globalServerProcess = p;
        }
    }


    private static _killGlobalServerProcess(secured: boolean): void {
        let p: ChildProcess;
        let store;
        if (secured) {
            p = this._globalSecuredServerProcess;
            this._globalSecuredServerProcess = null;
            if (this._globalSecuredServer) {
                this._globalSecuredServer.dispose();
                this._globalSecuredServer = null;
            }
        } else {
            p = this._globalServerProcess;
            this._globalServerProcess = null;
            if (this._globalServer) {
                this._globalServer.dispose();
                this._globalServer = null;
            }
        }

        const executorsDisposedTask = new Promise<void>(resolve => {
            if (store) {
                store.on("executorsDisposed", () => resolve());
            } else {
                resolve();
            }
        });
        wrapWithTimeout(executorsDisposedTask, 2000)
            .finally(() => this.stopServerProcess(p));

        if (store) {
            store.dispose();
        }
    }

    public utcToday() {
        return moment().utc().startOf("day");
    }

    public async waitForDocument<T extends object>(documentInfo: DocumentType<T>,
                                                   store: IDocumentStore,
                                                   docId: string,
                                                   predicate: (value: T) => void = null,
                                                   timeout: number = 10_000) {
        const sw = Stopwatch.createStarted();

        let ex: Error;

        while (sw.elapsed < timeout) {
            const session = store.openSession(store.database);

            try {
                const doc = await session.load(docId, documentInfo);
                if (doc) {
                    if (!predicate || predicate(doc)) {
                        return true;
                    }
                }
            } catch (e) {
                ex = e;
            }

            await delay(100);
        }

        return false;
    }

    public async getDocumentStore(): Promise<DocumentStore>;
    public async getDocumentStore(database: string): Promise<DocumentStore>;
    public async getDocumentStore(database: string, secured: boolean): Promise<DocumentStore>;
    public async getDocumentStore(
        database: string, secured: boolean, waitForIndexingTimeoutInMs?: number): Promise<DocumentStore>;
    public async getDocumentStore(
        database: string, secured: boolean, waitForIndexingTimeoutInMs?: number, customizeDatabaseRecord?: (record: DatabaseRecord) => void): Promise<DocumentStore>;
    public async getDocumentStore(
        database = "test_db", secured = false, waitForIndexingTimeoutInMs: number = null, customizeDatabaseRecord?: (record: DatabaseRecord) => void): Promise<DocumentStore> {

        const databaseName = database + "_" + (++RavenTestContext._index);
        log.info(`getDocumentStore for db ${ database }.`);

        if (!RavenTestContext._getGlobalServer(secured)) {
            await this._runServer(secured);
        }

        const documentStore = RavenTestContext._getGlobalServer(secured);
        const databaseRecord: DatabaseRecord = { databaseName, settings: {} };

        // force lucene on database level
        databaseRecord.settings[INDEXES.INDEXING_STATIC_SEARCH_ENGINE_TYPE] = "Lucene";
        databaseRecord.settings[INDEXES.INDEXING_AUTO_SEARCH_ENGINE_TYPE] = "Lucene";

        if (this._customizeDbRecord) {
            this._customizeDbRecord(databaseRecord);
        }

        customizeDatabaseRecord?.(databaseRecord);

        const createDatabaseOperation = new CreateDatabaseOperation(databaseRecord);
        const createDatabaseResult = await documentStore.maintenance.server.send(createDatabaseOperation);


        const store = new DocumentStore(documentStore.urls, databaseName);
        if (secured) {
            store.authOptions = this._securedLocator.getClientAuthOptions();
        }

        if (this._customizeStore) {
            await this._customizeStore(store);
        }

        store.initialize();

        (store as IDocumentStore)
            .once("afterDispose", async (callback) => {
                if (!this._documentStores.has(store)) {
                    callback();
                    return;
                }

                try {
                    await store.maintenance.server.send(new DeleteDatabasesOperation({
                        databaseNames: [store.database],
                        hardDelete: true
                    }));

                    log.info(`Database ${store.database} deleted.`);
                } catch (err) {
                    if (err.name === "DatabaseDoesNotExistException"
                        || err.name === "NoLeaderException") {
                        return;
                    }

                    if (store.isDisposed() || !RavenTestContext._getGlobalProcess(secured)) {
                        return;
                    }

                    throwError("TestDriverTearDownError",
                        `Error deleting database ${ store.database }.`, err);
                } finally {
                    callback();
                }
            });

        await this._setupDatabase(store);

        if (!TypeUtil.isNullOrUndefined(waitForIndexingTimeoutInMs)) {
            await this.waitForIndexing(store);
        }

        this._documentStores.add(store);
        return store;
    }

    public static setupServer(): RavenTestContext {
        return new RavenTestContext();
    }

    public dispose(): void {
        log.info("Dispose.");

        if (this._disposed) {
            return;
        }

        this._disposed = true;

        const STORE_DISPOSAL_TIMEOUT = 10000;
        const storeDisposalPromises = [...this._documentStores].map(async (store) => {
            try {
                const result = new Promise<void>((resolve) => {
                    store.once("executorsDisposed", () => {
                        resolve();
                    });
                })

                store.dispose();
                return wrapWithTimeout(result, STORE_DISPOSAL_TIMEOUT);
            } catch (err) {
                return getError("TestDriverTeardownError", "Error disposing document store", err);
            }
        });

        Promise.all(storeDisposalPromises)
            .then((errors) => {
                const anyErrors = errors.filter(x => x) as Error[];
                if (anyErrors.length) {
                    throw getError("AggregateException", "Error", null, { errors: anyErrors });
                }
            })
            .then(() => {
                if (RavenTestContext._globalSecuredServer) {
                    RavenTestContext._globalSecuredServer.dispose();
                }

                if (RavenTestContext._globalServer) {
                    RavenTestContext._globalServer.dispose();
                }
            })
            .finally(() => {
                RavenTestContext._killGlobalServerProcess(true);
                RavenTestContext._killGlobalServerProcess(false);
            });
    }
}

class TestCloudServiceLocator extends RavenServerLocator {

    private static readonly _defaultParams = {
        ServerUrl: "http://127.0.0.1:0",
        "Features.Availability": "Experimental"
    };

    private _extraParams: object = {};

    public constructor(extraParams: Record<string, string> = {}) {
        super();

        this._extraParams = extraParams;
    }

    getCommandArguments(): string[] {
        const items = Object.assign({}, TestCloudServiceLocator._defaultParams, this._extraParams);

        return Object.keys(items)
            .map(key => "--" + key + "=" + items[key]);
    }
}

export class ClusterTestContext extends RavenTestDriver implements IDisposable {

    private readonly _toDispose: IDisposable[] = [];

    private _dbCounter = 1;

    public getDatabaseName(): string {
        return "db_" + (++this._dbCounter);
    }

    public async createRaftCluster(numberOfNodes: number, customSettings: Record<string, string> = {}) {
        const cluster = new ClusterController();
        cluster.nodes = [];

        customSettings = {
            "Cluster.ElectionTimeoutInMs": "3000",
            ...customSettings
        }

        const allowedNodeTags = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

        const leaderIndex = 0;
        const leaderNodeTag = allowedNodeTags[leaderIndex];

        for (let i = 0 ; i < numberOfNodes; i++) {
            let process: ChildProcess;
            const store = await this._runServerInternal(new TestCloudServiceLocator(customSettings), p => process = p, null);

            const clusterNode = new ClusterNode();
            clusterNode.serverProcess = process;
            clusterNode.store = store;
            clusterNode.url = store.urls[0];
            clusterNode.nodeTag = allowedNodeTags[i];
            clusterNode.leader = i === leaderIndex;

            cluster.nodes.push(clusterNode);
        }

        await cluster.executeJsScript(leaderNodeTag, "server.ServerStore.EnsureNotPassiveAsync(null, \"" + leaderNodeTag + "\").Wait();");

        if (numberOfNodes > 1) {
            // add nodes to cluster
            for (let i = 0; i < numberOfNodes; i++) {
                if (i === leaderIndex) {
                    continue;
                }

                const nodeTag = allowedNodeTags[i];
                const url = cluster.nodes[i].url;

                await cluster.executeJsScript(leaderNodeTag, "server.ServerStore.ValidateFixedPort = false;" +
                    "server.ServerStore.AddNodeToClusterAsync(\"" + url + "\", \"" + nodeTag + "\", false, false, server.ServerStore.ServerShutdown).Wait();");

                await cluster.executeJsScript(nodeTag, "server.ServerStore.WaitForTopology(0, server.ServerStore.ServerShutdown).Wait();");
            }
        }

        // wait for license to activate
        for (const node of cluster.nodes) {
            await this.waitForValue(
                async () => {
                    const response = await cluster.executeJsScript(node.nodeTag, "return server.ServerStore.LicenseManager.LicenseStatus.Type !== 'Invalid'");
                    return response.result;
                }, true, {
                    timeout: 30_000
                });
        }

        return cluster;
    }

    public async waitForDocumentInCluster<T extends object>(documentInfo: DocumentType<T>,
                                       session: DocumentSession,
                                       docId: string,
                                       predicate: (value: T) => boolean,
                                       timeout: number) {
        const nodes = session.requestExecutor.getTopologyNodes();
        const stores = this._getDocumentStores(nodes, true);

        return this._waitForDocumentInClusterInternal(documentInfo, docId, predicate, timeout, stores);
    }

    private async _waitForDocumentInClusterInternal<T extends object>(documentInfo: DocumentType<T>, docId: string, predicate: (value: T) => boolean,
                                                                timeout: number, stores: DocumentStore[]) {
        for (const store of stores) {
            await this.waitForDocument(documentInfo, store, docId, predicate, timeout);
        }

        return true;
    }

    public async waitForDocument<T extends object>(documentInfo: DocumentType<T>,
                                             store: IDocumentStore,
                                             docId: string,
                                             predicate: (value: T) => void = null,
                                             timeout: number = 10_000) {
        const sw = Stopwatch.createStarted();

        let ex: Error;

        while (sw.elapsed < timeout) {
            const session = store.openSession(store.database);

            try {
                const doc = await session.load(docId, documentInfo);
                if (doc) {
                    if (!predicate || predicate(doc)) {
                        return true;
                    }
                }
            } catch (e) {
                ex = e;
            }

            await delay(100);
        }

        return false;
    }

    private _getDocumentStores(nodes: ServerNode[], disableTopologyUpdates: boolean) {
        const stores: DocumentStore[] = [];

        for (const node of nodes) {
            const store = new DocumentStore(node.url, node.database);
            store.conventions.disableTopologyUpdates = disableTopologyUpdates;

            store.initialize();
            stores.push(store);

            this._toDispose.push(store);
        }

        return stores;
    }

    public async waitForIndexingInTheCluster(store: IDocumentStore, dbName: string, timeout: number) {
        const record = await store.maintenance.server.send(new GetDatabaseRecordOperation(dbName || store.database));

        for (const nodeTag of getAllNodesFromTopology(record.topology)) {
            await this.waitForIndexing(store, dbName, timeout, false, nodeTag);
        }
    }

    dispose(): void {
        for (const disposable of this._toDispose) {
            try {
                disposable.dispose()
            } catch {
                // ignore
            }
        }
    }
}

class ClusterController implements IDisposable {
    public nodes: ClusterNode[];

    public async executeJsScript(nodeTag: string, script: string) {
        const targetNode = this.getNodeByTag(nodeTag);

        const store = new DocumentStore(targetNode.url, null);
        try {
            store.conventions.disableTopologyUpdates = true;
            store.initialize();

            return await store.maintenance.server.send(new AdminJsConsoleOperation(script));
        } finally {
            store.dispose();
        }
    }

    public async executeJsScriptRaw(nodeTag: string, script: string) {
        const targetNode = this.getNodeByTag(nodeTag);

        const jsConsole = new AdminJsConsoleOperation(script);
        const command = jsConsole.getCommand(new DocumentConventions());

        const serverNode = new ServerNode({
            url: targetNode.url
        });

        const request = command.createRequest(serverNode);

        const store = new DocumentStore(targetNode.url, "_");
        try {
            store.initialize();

            const httpAgent = await store.getRequestExecutor().getHttpAgent();
            const responseAndStream = await command.send(httpAgent, request);

            await command.processResponse(null, responseAndStream.response, responseAndStream.bodyStream, request.uri);

            return command.result;
        } finally {
            store.dispose();
        }
    }

    public getNodeByUrl(url: string) {
        return this.nodes.find(x => x.url === url)
            || throwError("InvalidOperationException", "Unable to find node with url: " + url);
    }

    public getWorkingServer(): ClusterNode {
        return this.nodes.find(x => !x.disposed)
            || throwError("InvalidOperationException", "Unable to find working server");
    }

    public getNodeByTag(nodeTag: string) {
        const node = this.nodes.find(x => x.nodeTag === nodeTag);

        if (!node) {
            throwError("InvalidArgumentException", "Unable to find node with tag: " + nodeTag);
        }

        return node;
    }

    public async getCurrentLeader(store: IDocumentStore) {
        const command = new GetClusterTopologyCommand();
        await store.getRequestExecutor().execute(command);

        return command.result.leader;
    }

    public async disposeServer(nodeTag: string) {
        try {
            this.getNodeByTag(nodeTag).disposed = true;
            await this.executeJsScriptRaw(nodeTag, "server.Dispose()");
        } catch {
            // we likely throw as server won't be able to respond
        }
    }

    public getInitialLeader() {
        return this.nodes.find(x => x.leader);
    }

    public async createDatabase(databaseName: string, replicationFactor: number, leaderUrl: string);
    public async createDatabase(databaseRecord: DatabaseRecord, replicationFactor: number, leaderUrl: string);
    public async createDatabase(databaseRecordOrName: DatabaseRecord | string, replicationFactor: number, leaderUrl: string) {
        const databaseRecord: DatabaseRecord = TypeUtil.isString(databaseRecordOrName)
            ? { databaseName: databaseRecordOrName }
            : databaseRecordOrName;

        const store = new DocumentStore(leaderUrl, databaseRecord.databaseName);

        try {
            store.initialize();

            const putResult = await store.maintenance.server.send(new CreateDatabaseOperation(databaseRecord, replicationFactor));

            for (const node of this.nodes) {
                await this.executeJsScript(node.nodeTag, "server.ServerStore.Cluster.WaitForIndexNotification(\"" + putResult.raftCommandIndex + "\").Wait()");
            }

            return putResult;
        } finally {
            store.dispose();
        }
    }

    public dispose() {
        for (const node of this.nodes) {
            try {
                RavenTestContext.stopServerProcess(node.serverProcess);
            } catch {
                // ignore
            }
        }
    }
}

class ClusterNode {
    public nodeTag: string;
    public url: string;
    public leader: boolean;
    public store: IDocumentStore;
    public serverProcess: ChildProcess;
    public disposed: boolean;
}

export async function disposeTestDocumentStore(store: IDocumentStore) {
    if (!store) {
        return;
    }

    return new Promise<void>(resolve => {
        if (store) {
            store.once("executorsDisposed", () => resolve());
            store.dispose();
        }
    });
}

export let testContext: RavenTestContext;
setupRavenDbTestContext();

export let clusterTestContext: ClusterTestContext;

function setupRavenDbTestContext() {

    before(() => {
        testContext = RavenTestContext.setupServer();
    });

    afterEach(function () {
        if (this.currentTest && this.currentTest.state === "failed") {
            // eslint-disable-next-line no-console
            console.error(this.currentTest.err);
        }
    });

    after(() => {
        testContext.dispose();
    });

    return testContext;
}

export async function storeNewDoc(
    session: IDocumentSession, data: object, id: string, clazz: any) {
    const order = Object.assign(new clazz(), data);
    await session.store(order, id);
    return order;
}


export class TemporaryDirContext implements IDisposable {

    public tempDir: string;

    constructor() {
        this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rdb-node-"));
    }

    dispose(): void {
        sync(this.tempDir);
    }
}
