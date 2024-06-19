import {
    IDocumentStore,
    RevisionsCollectionConfiguration,
    ConfigureRevisionsForConflictsOperation
} from "../../../../src/index.js";
import { disposeTestDocumentStore, RavenTestContext, testContext } from "../../../Utils/TestUtil.js";
import { ReplicationTestContext } from "../../../Utils/ReplicationTestContext.js";
import { assertThat } from "../../../Utils/AssertExtensions.js";
import { Company, User } from "../../../Assets/Entities.js";

(RavenTestContext.isPullRequest ? describe.skip : describe)("ReplicationWithRevisions", function () {

    let store: IDocumentStore;
    let replication: ReplicationTestContext;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
        replication = new ReplicationTestContext();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canDisableRevisionsConflict", async () => {
        let storeA: IDocumentStore;
        let storeB: IDocumentStore;
        try {
            storeA = await testContext.getDocumentStore();

            try {
                storeB = await testContext.getDocumentStore();

                const collectionConfiguration = new RevisionsCollectionConfiguration();
                collectionConfiguration.disabled = true;

                const conflictsOperation = new ConfigureRevisionsForConflictsOperation(storeB.database, collectionConfiguration);
                const result = await storeB.maintenance.server.send(conflictsOperation);

                assertThat(result.raftCommandIndex)
                    .isGreaterThan(0);

                {
                    const session = storeB.openSession();
                    await session.store(new Company(), "keep-conflicted-revision-insert-order");
                    await session.saveChanges();

                    const karmel = Object.assign(new User(), {
                        name: "Karmel-A-1"
                    });

                    await session.store(karmel, "foo/bar");
                    await session.saveChanges();
                }

                {
                    const session = storeA.openSession();
                    const user = Object.assign(new User(), {
                        name: "Karmel-B-1"
                    });
                    await session.store(user);
                    await session.saveChanges();
                }

                await replication.setupReplication(storeA, storeB);
                await replication.ensureReplicating(storeA, storeB);

                {
                    const session = storeB.openSession();
                    assertThat((await session.advanced.revisions.getMetadataFor("foo/bar")).length)
                        .isZero();
                }

            } finally {
                storeB.dispose();
            }
        } finally {
            storeA.dispose();
        }
    });
});
