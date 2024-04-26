import assert from "node:assert"
import { testContext, disposeTestDocumentStore } from "../../../../Utils/TestUtil.js";

import {
    IDocumentStore,
} from "../../../../../src.js";
import { User } from "../../../../Assets/Entities.js";
import { DocumentChange } from "../../../../../src.js";
import { AsyncQueue } from "../../../../Utils/AsyncQueue.js";
import { throwError } from "../../../../../src/Exceptions.js";

describe("Secured changes test", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getSecuredDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("can connect using https", async () => {

        const changesList = new AsyncQueue<DocumentChange>();

        const changes = store.changes();
        await changes.ensureConnectedNow();

        const observable = changes.forDocument("users/1");
        await observable.ensureSubscribedNow();

        const handler = (change: DocumentChange) => changesList.push(change);

        try {
            observable.on("data", handler);
            observable.on("error", e => throwError("InvalidOperationException", e.message));

            {
                const session = store.openSession();
                const user = new User();
                await session.store(user, "users/1");
                await session.saveChanges();
            }

            const documentChange = await changesList.poll(2000);
            assert.ok(documentChange);

            assert.strictEqual(documentChange.id, "users/1");
            assert.strictEqual(documentChange.type, "Put");

            try {
                await changesList.poll(100);
                assert.fail("Should have thrown");
            } catch (err) {
                assert.strictEqual(err.name, "TimeoutException");
            }
        } finally {
            observable.off("data", handler);
        }

        // at this point we should be unsubscribed from changes on 'users/1'

        {
            const session = store.openSession();
            const user = new User();
            user.name = "another name";
            await session.store(user, "users/1");
            await session.saveChanges();
        }

        // it should be empty as we destroyed subscription
        try {
            await changesList.poll(100);
            assert.fail("Should have thrown");
        } catch (err) {
            assert.strictEqual(err.name, "TimeoutException");
        }
    });

});
