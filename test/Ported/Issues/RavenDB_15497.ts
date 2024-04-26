import {
    IDocumentStore, StopIndexOperation
} from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { assertThat, assertThrows } from "../../Utils/AssertExtensions.js";
import { User } from "../../Assets/Entities.js";
import { AbstractJavaScriptIndexCreationTask } from "../../../src/Documents/Indexes/AbstractJavaScriptIndexCreationTask.js";

describe("RavenDB_15497", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("waitForIndexesAfterSaveChangesCanExitWhenThrowOnTimeoutIsFalse", async () => {
        const index = new Index();
        await index.execute(store);

        {
            const session = store.openSession();
            const user = new User();
            user.name = "user1";

            await session.store(user);

            session.advanced.waitForIndexesAfterSaveChanges({
                throwOnTimeout: false,
                timeout: 3_000
            });

            await session.saveChanges();
        }

        await testContext.waitForIndexing(store);

        await store.maintenance.send(new StopIndexOperation(index.getIndexName()));

        {
            const session = store.openSession();
            const user = new User();
            user.name = "user1";

            await session.store(user);

            session.advanced.waitForIndexesAfterSaveChanges({
                timeout: 3_000,
                throwOnTimeout: true
            });

            await assertThrows(() => session.saveChanges(), e => {
                assertThat(e.name)
                    .isEqualTo("RavenTimeoutException");
                assertThat(e.message)
                    .contains("RavenTimeoutException");
                assertThat(e.message)
                    .contains("could not verify that");
            });
        }
    });
});


class Index extends AbstractJavaScriptIndexCreationTask<User, Pick<User, "name">> {
    constructor() {
        super();

        this.map(User, u => {
            return {
                name: u.name
            }
        });
    }
}
