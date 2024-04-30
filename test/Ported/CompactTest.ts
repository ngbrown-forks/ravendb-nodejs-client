import { User } from "../Assets/Entities.js";
import assert from "node:assert"
import { testContext, disposeTestDocumentStore } from "../Utils/TestUtil.js";

import {
    IDocumentStore,
    CompactDatabaseOperation, CompactSettings,
} from "../../src/index.js";

describe("CompactTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    it("can compact database", async () => {
        const session = store.openSession();
        const user1 = Object.assign(new User(), { lastName: "user1" });
        await session.store(user1, "users/1");
        await session.saveChanges();

        const compactSettings: CompactSettings = {
            databaseName: store.database,
            documents: true
        };

        const operationAwaiter = await store.maintenance.server.send(new CompactDatabaseOperation(compactSettings));

        try {
            // we can't compact in memory database but here we just test is request was send successfully
            await operationAwaiter.waitForCompletion();
            assert.fail("It should have thrown.");
        } catch (err) {
            assert.ok(
                err.message.includes("Unable to cast object of type 'PureMemoryStorageEnvironmentOptions' "
                    + "to type 'DirectoryStorageEnvironmentOptions'"), "Actual error: " + err.stack);
        }
    });
});
