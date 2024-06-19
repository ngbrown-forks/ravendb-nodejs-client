import { ClusterTestContext, RavenTestContext } from "../../../Utils/TestUtil.js";
import { DocumentStore } from "../../../../src/index.js";
import { User } from "../../../Assets/Entities.js";
import { assertThat } from "../../../Utils/AssertExtensions.js";

(RavenTestContext.isPullRequest ? describe.skip : describe)("ReplicationWriteAssuranceTest", function () {

    const testContext = new ClusterTestContext();

    it("serverSideWriteAssurance", async () => {
        const cluster = await testContext.createRaftCluster(3);
        try {

            const initialLeader = cluster.getInitialLeader();

            const database = testContext.getDatabaseName();
            const numberOfNodes = 3;

            await cluster.createDatabase({
                databaseName: database
            }, numberOfNodes, cluster.getInitialLeader().url);

            const store = new DocumentStore(cluster.getInitialLeader().url, database);
            try {
                store.initialize();

                const session = store.openSession();

                session.advanced.waitForReplicationAfterSaveChanges({
                    replicas: 2,
                    timeout: 30_000
                });

                const user = new User();
                user.name = "Idan";
                await session.store(user, "users/1");
                await session.saveChanges();

            } finally {
                store.dispose();
            }

            for (const node of cluster.nodes) {
                const store = new DocumentStore(node.url, database);
                try {
                    store.conventions.disableTopologyUpdates = true;
                    store.initialize();

                    const session = store.openSession();
                    assertThat(await session.load("users/1", User))
                        .isNotNull();
                } finally {
                    store.dispose();
                }
            }
        } finally {
            cluster.dispose();
        }
    });

});