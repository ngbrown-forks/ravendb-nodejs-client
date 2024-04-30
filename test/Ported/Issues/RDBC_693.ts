import { testContext, disposeTestDocumentStore } from "../../Utils/TestUtil.js";

import {
    IDocumentStore, DocumentChange, GetDatabaseRecordOperation,
} from "../../../src/index.js";
import { User } from "../../Assets/Entities.js";
import { AsyncQueue } from "../../Utils/AsyncQueue.js";
import { throwError } from "../../../src/Exceptions/index.js";
import { assertThat, assertThrows } from "../../Utils/AssertExtensions.js";

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
