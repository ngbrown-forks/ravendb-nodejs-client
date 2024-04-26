import { testContext, disposeTestDocumentStore } from "../../Utils/TestUtil.js";

import {
    IDocumentStore,
} from "../../../src/index.js";

describe("Query with includes", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it.skip("TODO");
});
