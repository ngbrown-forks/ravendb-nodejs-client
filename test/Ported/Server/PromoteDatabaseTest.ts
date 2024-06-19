import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import {
    IDocumentStore,
    PromoteDatabaseNodeOperation
} from "../../../src/index.js";

describe("PromoteDatabaseTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canSendPromoteDatabaseCommand", async () => {
        const operation = new PromoteDatabaseNodeOperation(store.database, "A");
        await store.maintenance.server.send(operation);

        // since we are running single node cluster we cannot assert much
    });

});
