import { IDocumentStore } from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { User } from "../../Assets/Entities.js";
import { assertThat } from "../../Utils/AssertExtensions.js";

describe("RavenDB_17551Test", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canUseOffsetWithCollectionQuery", async () => {
        {
            const session = store.openSession();
            for (let i = 0; i < 5; i++) {
                const user = new User();
                user.name = "i = " + i;
                await session.store(user);
            }

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            assertThat(await session.query(User)
                .take(3)
                .skip(2)
                .all())
                .hasSize(3);
            assertThat(await session.query(User)
                .take(3)
                .skip(3)
                .all())
                .hasSize(2);
        }
    });
});
