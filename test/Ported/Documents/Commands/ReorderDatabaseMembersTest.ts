import { IDocumentStore } from "../../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../../Utils/TestUtil.js";
import { ReorderDatabaseMembersOperation } from "../../../../src/ServerWide/Operations/ReorderDatabaseMembersOperation.js";

describe("ReorderDatabaseMembersTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canSendReorderCommand", async () => {
        await store.maintenance.send(new ReorderDatabaseMembersOperation(store.database, ["A"]));
    });

});
