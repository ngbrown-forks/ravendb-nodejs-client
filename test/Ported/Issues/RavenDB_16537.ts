import { IDocumentStore } from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { assertThat } from "../../Utils/AssertExtensions.js";

describe("RavenDB_16537Test", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("can_Use_OnSessionDisposing_Event", async () => {
        let counter = 0;

        {
            const session = store.openSession();
            session.advanced.on("sessionDisposing", () => counter++);
            session.dispose();
        }

        assertThat(counter)
            .isEqualTo(1);

        store.addSessionListener("sessionDisposing", () => counter++);

        {
            const session = store.openSession();
            session.dispose();
        }

        assertThat(counter)
            .isEqualTo(2);
    });
});
