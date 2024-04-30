import { IDocumentStore } from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { assertThat } from "../../Utils/AssertExtensions.js";

describe("RavenDB_15492Test", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("willCallOnBeforeDeleteWhenCallingDeleteById", async () => {
        const session = store.openSession();
        let called = false;

        session.advanced.on("beforeDelete", eventArgs => {
            called = eventArgs.documentId === "users/1";
        });

        await session.delete("users/1");
        await session.saveChanges();

        assertThat(called)
            .isTrue();
    });
});