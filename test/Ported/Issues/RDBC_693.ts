import { testContext, disposeTestDocumentStore } from "../../Utils/TestUtil.js";

import {
    IDocumentStore,
    GetDatabaseRecordOperation,
} from "../../../src/index.js";
import { assertThat } from "../../Utils/AssertExtensions.js";

describe("RDBC_693", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("can handle 404 in GetDatabaseRecordOperation", async () => {
        const dbRecord = await store.maintenance.server.send(new GetDatabaseRecordOperation("DB_WHICH_DOESNT_EXIST"));
        assertThat(dbRecord)
            .isNull();
    });
});
