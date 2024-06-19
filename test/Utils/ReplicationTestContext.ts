import {
    IDocumentStore,
    PutConnectionStringOperation,
    ReplicationNode,
    ExternalReplication,
    RavenConnectionString,
    ModifyOngoingTaskResult,
    IMaintenanceOperation,
    OngoingTaskType,
    DocumentType,
    DeleteOngoingTaskOperation,
    UpdateExternalReplicationOperation,
    GetDatabaseRecordOperation,
    PullReplicationAsSink,
    ExternalReplicationBase,
    UpdatePullReplicationAsSinkOperation
} from "../../src/index.js";
import { Stopwatch } from "../../src/Utility/Stopwatch.js";
import { delay } from "../../src/Utility/PromiseUtil.js";
import { randomUUID } from "node:crypto";
import { assertThat } from "./AssertExtensions.js";

export class ReplicationTestContext {

    protected _modifyReplicationDestination(replicationNode: ReplicationNode) {
        // empty by design
    }

    public async ensureReplicating(src: IDocumentStore, dst: IDocumentStore) {
        const id = "marker/" + randomUUID();

        {
            const s = src.openSession();
            await s.store(new Marker(), id);
            await s.saveChanges();
        }

        assertThat(await this.waitForDocumentToReplicate(dst, id, 15_000, Marker))
            .isNotNull();
    }

    public async setupReplication(fromStore: IDocumentStore, ...destinations: IDocumentStore[]): Promise<ModifyOngoingTaskResult[]> {
        const result = [] as ModifyOngoingTaskResult[];

        for (const store of destinations) {
            const databaseWatcher: ExternalReplication = {
                database: store.database,
                connectionStringName: "ConnectionString-" + store.identifier
            };

            await this._modifyReplicationDestination(databaseWatcher);
            result.push(await ReplicationTestContext.addWatcherToReplicationTopology(fromStore, databaseWatcher));
        }

        return result;
    }

    public static async addWatcherToReplicationTopology(store: IDocumentStore, watcher: ExternalReplicationBase, ...urls: string[]): Promise<ModifyOngoingTaskResult> {
        const connectionString = new RavenConnectionString();
        connectionString.name = watcher.connectionStringName;
        connectionString.database = watcher.database;
        connectionString.topologyDiscoveryUrls = urls && urls.length ? urls : store.urls;

        await store.maintenance.send(new PutConnectionStringOperation(connectionString));

        const op: IMaintenanceOperation<ModifyOngoingTaskResult> = "hubName" in watcher
            ? new UpdatePullReplicationAsSinkOperation(watcher as PullReplicationAsSink)
            : new UpdateExternalReplicationOperation(watcher);

        return await store.maintenance.send(op);
    }

    public async deleteOngoingTask(store: IDocumentStore, taskId: number, taskType: OngoingTaskType) {
        const op = new DeleteOngoingTaskOperation(taskId, taskType);
        return store.maintenance.send(op);
    }

    public async waitForDocumentToReplicate<T extends object>(
        store: IDocumentStore, id: string, timeout: number, documentType: DocumentType<T>): Promise<T> {
        const sw = Stopwatch.createStarted();

        while (sw.elapsed <= timeout) {
            const session = store.openSession({
                noCaching: true,
                noTracking: true
            });

            const doc: T = await session.load<T>(id, documentType);
            if (doc) {
                return doc;
            }

            await delay(100);
        }

        return null;
    }

    protected static async getPromotableCount(store: IDocumentStore, databaseName: string): Promise<number> {
        const res = await store.maintenance.server.send(new GetDatabaseRecordOperation(databaseName));
        if (!res) {
            return -1;
        }

        return res.topology.promotables.length;
    }

    protected static async getRehabCount(store: IDocumentStore, databaseName: string): Promise<number> {
        const res = await store.maintenance.server.send(new GetDatabaseRecordOperation(databaseName));
        if (!res) {
            return -1;
        }

        return res.topology.rehabs.length;
    }

    protected static async getMembersCount(store: IDocumentStore, databaseName: string): Promise<number> {
        const res = await store.maintenance.server.send(new GetDatabaseRecordOperation(databaseName));
        if (!res) {
            return -1;
        }

        return res.topology.members.length;
    }

    protected static async getDeletionCount(store: IDocumentStore, databaseName: string): Promise<number> {
        const res = await store.maintenance.server.send(new GetDatabaseRecordOperation(databaseName));
        if (!res) {
            return -1;
        }

        return Object.keys(res.deletionInProgress).length;
    }
}

class Marker {
    public id: string;
}
