import { DocumentStore, GetDatabaseRecordOperation } from "../../../src/index.js";
import { ClusterTestContext, RavenTestContext } from "../../Utils/TestUtil.js";
import { DatabaseRecordBuilder } from "../../../src/ServerWide/Operations/DatabaseRecordBuilder.js";
import {
    AddNodeToOrchestratorTopologyOperation
} from "../../../src/ServerWide/Sharding/AddNodeToOrchestratorTopologyOperation.js";
import { assertThat } from "../../Utils/AssertExtensions.js";
import {
    RemoveNodeFromOrchestratorTopologyOperation
} from "../../../src/ServerWide/Sharding/RemoveNodeFromOrchestratorTopologyOperation.js";
import { AddDatabaseShardOperation } from "../../../src/ServerWide/Sharding/AddDatabaseShardOperation.js";

(RavenTestContext.isPullRequest ? describe.skip : describe)("ShardedDatabasesTest", function () {
    let testContext: ClusterTestContext;

    beforeEach(async () => testContext = new ClusterTestContext());
    afterEach(async () => testContext.dispose());

    it("canWorkWithShardedDatabase", async function () {
        const cluster = await testContext.createRaftCluster(3);

        try {
            const database = testContext.getDatabaseName();

            // create sharded db on two nodes (A, B) and single orchestrator on C
            let record = DatabaseRecordBuilder.create()
                .sharded(database, b => b
                    .orchestrator(o => o.addNode("C"))
                    .addShard(1, s => s.addNode("A"))
                    .addShard(2, s => s.addNode("B")))
                .toDatabaseRecord();

            await cluster.createDatabase(record, 1, cluster.getInitialLeader().url);

            {
                const store = new DocumentStore(cluster.getInitialLeader().url, "_");
                try {
                    store.initialize();

                    // add B as orchestrator
                    // so current topology: orchestrators (B, C), shard #1 (A), shard #2 (B)

                    await store.maintenance.server.send(new AddNodeToOrchestratorTopologyOperation(database, "B"));

                    await testContext.waitForValue(async () => {
                        const r = await store.maintenance.server.send(new GetDatabaseRecordOperation(database));
                        return r.topology?.members.includes("B");
                    }, true);

                    record = await store.maintenance.server.send(new GetDatabaseRecordOperation(database));
                    let topology = record.sharding.orchestrator.topology;

                    assertThat(topology)
                        .isNotNull();
                    assertThat(topology.members)
                        .contains("B")
                        .contains("C");

                    // now remove C from orchestrators
                    // so current topology: orchestrators (B), shard #1 (A), shard #2 (B)

                    await store.maintenance.server.send(new RemoveNodeFromOrchestratorTopologyOperation(database, "C"));

                    record = await store.maintenance.server.send(new GetDatabaseRecordOperation(database));
                    topology = record.sharding.orchestrator.topology;

                    assertThat(topology)
                        .isNotNull();
                    assertThat(topology.members)
                        .hasSize(1)
                        .contains("B");

                    // now add new shard
                    // so current topology: orchestrators (B), shard #1 (A), shard #2 (B), shard #3 (A, B)

                    await store.maintenance.server.send(new AddDatabaseShardOperation({
                        databaseName: database,
                        nodes: ["A", "B"]
                    }));

                    record = await store.maintenance.server.send(new GetDatabaseRecordOperation(database));
                    assertThat(record.sharding.shards)
                        .hasSize(3);
                } finally {
                    store.dispose();
                }
            }
        } finally {
            cluster.dispose();
        }
    });
});
