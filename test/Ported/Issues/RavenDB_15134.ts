import {
    IDocumentStore,
    GetCountersOperation
} from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { User } from "../../Assets/Entities.js";
import { assertThat } from "../../Utils/AssertExtensions.js";

describe("RavenDB_15134", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("getCountersOperationShouldReturnNullForNonExistingCounter", async () => {
        const docId = "users/1";

        {
            const session = store.openSession();
            await session.store(new User(), docId);

            const c = session.countersFor(docId);

            c.increment("likes");
            c.increment("dislikes", 2);

            await session.saveChanges();
        }

        let vals = await store.operations.send(new GetCountersOperation(docId, ["likes", "downloads", "dislikes"]));
        assertThat(vals.counters)
            .hasSize(3);


        assertThat(vals.counters.filter(x => !x).length)
            .isGreaterThan(0);
        assertThat(vals.counters.some(x => x && x.totalValue === 1))
            .isTrue();
        assertThat(vals.counters.some(x => x && x.totalValue === 2))
            .isTrue();

        assertThat(vals.counters[0].totalValue)
            .isEqualTo(1);
        assertThat(vals.counters[1])
            .isNull();
        assertThat(vals.counters[2].totalValue)
            .isEqualTo(2);

        vals = await store.operations.send(new GetCountersOperation(docId, ["likes", "downloads", "dislikes"], true));
        assertThat(vals.counters)
            .hasSize(3);

        assertThat(vals.counters.filter(x => !x).length)
            .isGreaterThan(0);
        assertThat(vals.counters.some(x => x && Object.keys(x.counterValues).length === 1))
            .isTrue();
    });

});
