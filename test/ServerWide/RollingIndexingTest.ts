import { UsersIndex } from "../Assets/Indexes.js";
import { DocumentStore, GetDatabaseRecordOperation } from "../../src/index.js";
import { ClusterTestContext, RavenTestContext } from "../Utils/TestUtil.js";
import { User } from "../Assets/Entities.js";
import { assertThat } from "../Utils/AssertExtensions.js";

(RavenTestContext.isPullRequest ? describe.skip : describe)("ClusterModesForRequestExecutorTest", function () {

    let testContext: ClusterTestContext;

    beforeEach(async function () {
        testContext = new ClusterTestContext();
    });

    afterEach(async () => testContext.dispose());

    it("can map rolling indexes types", async function () {
        const cluster = await testContext.createRaftCluster(2);
        try {

            const databaseName = testContext.getDatabaseName();
            const numberOfNodes = 2;

            await cluster.createDatabase({
                databaseName
            }, numberOfNodes, cluster.getInitialLeader().url);


            let leaderStore: DocumentStore;
            try {
                leaderStore = new DocumentStore(cluster.getInitialLeader().url, databaseName);
                leaderStore.initialize();

                {
                    const session = leaderStore.openSession();
                    const user = new User();
                    user.name = "John";
                    await session.store(user, "users/1-A");
                    await session.saveChanges();
                }

                const index = new UsersIndex();
                index.deploymentMode = "Rolling";

                await leaderStore.executeIndexes([index]);

                await testContext.waitForIndexingInTheCluster(leaderStore, leaderStore.database, 10_000);

                const databaseRecord = await leaderStore.maintenance.server.send(new GetDatabaseRecordOperation(leaderStore.database));

                const indexHistory = databaseRecord.indexesHistory["UsersIndex"][0];
                assertThat(indexHistory)
                    .isNotNull();

                assertThat(indexHistory.rollingDeployment)
                    .isNotNull();

                assertThat(indexHistory.rollingDeployment["A"])
                    .isNotNull();

                assertThat(indexHistory.rollingDeployment["A"].startedAt instanceof Date)
                    .isTrue();
                assertThat(indexHistory.rollingDeployment["A"].createdAt instanceof Date)
                    .isTrue();
                assertThat(indexHistory.rollingDeployment["A"].finishedAt instanceof Date)
                    .isTrue();
            } finally {
                leaderStore.dispose();
            }
        } finally {
            cluster.dispose();
        }
    });
});
