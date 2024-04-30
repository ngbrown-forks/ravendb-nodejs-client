import { IDocumentStore } from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { assertThat } from "../../Utils/AssertExtensions.js";

describe("RavenDB_17420Test", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("can_use_boost_on_in_query", async () => {
        {
            const session = store.openSession();
            const item = new Item();
            item.name = "ET";
            await session.store(item);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const first = await session.advanced.documentQuery(Item)
                .whereIn("name", ["ET", "Alien"])
                .boost(0)
                .first();

            assertThat(session.advanced.getMetadataFor(first)["@index-score"])
                .isZero();
        }
    });
});


class Item {
    name: string;
}
