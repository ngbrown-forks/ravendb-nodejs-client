import {
    ConfigureRevisionsOperation,
    IDocumentStore,
    RevisionsConfiguration
} from "../../../src/index.js";
import { disposeTestDocumentStore, RavenTestContext, testContext } from "../../Utils/TestUtil.js";
import { User } from "../../Assets/Entities.js";
import { assertThat } from "../../Utils/AssertExtensions.js";

(RavenTestContext.isPullRequest ? describe.skip : describe)("RavenDB_14724", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("deleteDocumentAndRevisions", async () => {
        let user = new User();
        user.name = "Raven";
        const id = "users/1";

        {
            await testContext.setupRevisions(store, true, 5);

            {
                const session = store.openSession();
                await session.store(user, id);
                await session.saveChanges();
            }

            {
                const session = store.openSession();
                user = await session.load<User>(id, User);
                user.age = 10;

                await session.store(user);
                await session.saveChanges();

                const metadata = session.advanced.getMetadataFor(user);

                assertThat(metadata["@flags"])
                    .isEqualTo("HasRevisions");

                const revisions = await session.advanced.revisions.getFor<User>(id, {
                    documentType: User
                });
                assertThat(revisions)
                    .hasSize(2);

                await session.delete(id);
                await session.saveChanges();

                const configuration = new RevisionsConfiguration();
                configuration.defaultConfig = null;

                const operation = new ConfigureRevisionsOperation(configuration);
                await store.maintenance.send(operation);
            }

            {
                const session = store.openSession();
                await session.store(user, id);
                await session.saveChanges();

                await testContext.setupRevisions(store, false, 5);
            }

            {
                const session = store.openSession();
                user = await session.load<User>(id, User);
                const revisions = await session.advanced.revisions.getFor<User>(id, {
                    documentType: User
                });
                assertThat(revisions)
                    .hasSize(0);
            }
        }
    });
});
