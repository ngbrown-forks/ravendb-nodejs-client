import { testContext, disposeTestDocumentStore } from "../../../Utils/TestUtil.js";

import {
    DocumentStore,
    IDocumentStore,
    StreamResult,
} from "../../../../src.js";
import assert from "node:assert"
import { User } from "../../../Assets/Entities.js";
import { CONSTANTS } from "../../../../src/Constants.js";
import { ObjectUtil } from "../../../../src/Utility/ObjectUtil.js";

describe("document streaming", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    function argError(): never {
        throw new Error("Arg is required.");
    }

    async function prepareData(storeToUse: IDocumentStore, n: number = argError()) {
        const session = storeToUse.openSession();

        for (let i = 0; i < n; i++) {
            await session.store(Object.assign(new User(), {
                name: "jon" + i,
                lastName: "snow" + i
            }));
        }
        await session.saveChanges();
    }

    async function streamDocuments(remoteCasing : "camel" | "pascal" = "camel") {
        const newStore = new DocumentStore(store.urls, store.database);

        if (remoteCasing === "pascal") {
            newStore.conventions.findCollectionNameForObjectLiteral = (o) => o["collection"];
            newStore.conventions.serverToLocalFieldNameConverter = ObjectUtil.camel;
            newStore.conventions.localToServerFieldNameConverter = ObjectUtil.pascal;
            newStore.conventions.identityProperty = "Id";
            newStore.conventions.registerEntityIdPropertyName(Object, "Id");
        }

        newStore.initialize();
        try {

            await prepareData(newStore, 200);

            {
                const session = newStore.openSession();

                const queryStream = await session.advanced.stream<User>("users/");

                const items = [];

                for await (const item of queryStream) {
                    items.push(item);
                }

                assert.strictEqual(items.length, 200);
                for (const item of items) {
                    assertStreamResultEntry(item, (doc: any) => {
                        assert.ok(doc);
                        assert.ok(doc.name);
                        assert.ok(doc.lastName);
                    });
                }
            }
        } finally {
            newStore.dispose();
        }
    }



    it("can stream documents starting with - jsonl - camel", async () => {
        await streamDocuments();
    });


    it("can stream documents starting with - jsonl - pascal", async () => {
        await streamDocuments("pascal");
    });
    
    it("[TODO] can stream starting with prefix using opts");

    it("can stream without iteration does not leak connection", async () => {
        await prepareData(store, 200);
        for (let i = 0; i < 5; i++) {
            {
                const session = store.openSession();
                await session.advanced.stream<User>("users/");
            }
        }
    });

    function assertStreamResultEntry<T extends object>(
        entry: StreamResult<T>, docAssert: (doc: T) => void) {
        assert.ok(entry);
        assert.strictEqual(entry.constructor.name, Object.name);
        assert.ok(entry.changeVector);
        assert.ok(entry.id);
        assert.ok(entry.metadata);
        assert.ok(entry.metadata[CONSTANTS.Documents.Metadata.ID]);
        assert.ok(entry.metadata[CONSTANTS.Documents.Metadata.RAVEN_JS_TYPE]);
        assert.ok(entry.metadata[CONSTANTS.Documents.Metadata.LAST_MODIFIED]);

        const doc = entry.document;
        assert.ok(doc);
        docAssert(doc);
    }
});
