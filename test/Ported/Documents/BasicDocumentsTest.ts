import assert from "node:assert"
import { testContext, disposeTestDocumentStore } from "../../Utils/TestUtil.js";

import {
    IDocumentStore,
    DocumentSession,
    GetDocumentsCommand
} from "../../../src/index.js";
import { User, Person } from "../../Assets/Entities.js";

describe("Basic documents test", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("can change document collection with delete and save", async () => {
        const documentId = "users/1";
        const session = store.openSession();
        let user = Object.assign(new User(), { name: "Grisha" });
        await session.store(user);
        await session.saveChanges();

        const session2 = store.openSession();
        await session2.delete(documentId);
        await session2.saveChanges();

        const session3 = store.openSession();
        user = await session3.load<User>(documentId);
        assert.ok(user === null);

        const session4 = store.openSession();
        const person = Object.assign(new Person(), { name: "Grisha" });
        await session4.store(person);
        await session4.saveChanges();
    });

    class Animal {
        public id: string;
        public name: string;
    }

    class Dog extends Animal {
        public dogRace: string;
    }

    class Cat extends Animal {
        public hasFur: boolean;
    }

    it.skip("sets proper type when loading using another class", async () => {
        const session = store.openSession();
        const dog = Object.assign(new Dog(), {
            name: "Chase",
            dogRace: "Alsatian"
        });
        await session.store(dog);

        await session.saveChanges();

        const cat = await session.load(dog.id, Cat);
        assert.strictEqual(cat.constructor, Cat);
    });

    it("get", async () => {
        const dummy = new User();
        delete dummy.id;

        {
            const session = store.openSession();
            const user1 = Object.assign(new User(), { name: "Fitzchak" });
            const user2 = Object.assign(new User(), { name: "Arek" });

            await session.store(user1, "users/1");
            await session.store(user2, "users/2");
            await session.saveChanges();
        }

        const requestExecutor = store.getRequestExecutor();
        let getDocumentsCommand = new GetDocumentsCommand({
            ids: ["users/1", "users/2"],
            includes: null,
            metadataOnly: false,
            conventions: store.conventions
        });

        await requestExecutor.execute(getDocumentsCommand);
        let docs = getDocumentsCommand.result;
        assert.strictEqual(docs.results.length, 2);

        let doc1 = docs.results[0];
        let doc2 = docs.results[1];
        assert.ok(doc1);

        let doc1Properties = Object.keys(doc1);
        assert.ok(doc1Properties.includes("@metadata"));
        assert.strictEqual(doc1Properties.length, 2); // name, @metadata

        assert.ok(doc2);
        let doc2Properties = Object.keys(doc2);
        assert.ok(doc2Properties.includes("@metadata"));
        assert.strictEqual(doc2Properties.length, 2); // name, @metadata

        {
            const session = store.openSession() as DocumentSession;
            const trackEntity = false;
            const user1 = session.entityToJson.convertToEntity(User, "users/1", doc1, trackEntity) as User;
            const user2 = session.entityToJson.convertToEntity(User, "users/2", doc2, trackEntity) as User;

            assert.ok(user1 instanceof User);
            assert.ok(user2 instanceof User);

            assert.strictEqual(user1.name, "Fitzchak");
            assert.strictEqual(user2.name, "Arek");

            getDocumentsCommand = new GetDocumentsCommand({
                ids: ["users/1", "users/2"],
                metadataOnly: true,
                conventions: store.conventions
            });

            await requestExecutor.execute(getDocumentsCommand);

            docs = getDocumentsCommand.result;
            assert.strictEqual(docs.results.length, 2);

            [doc1, doc2] = docs.results;
            assert.ok(doc1);
            doc1Properties = Object.keys(doc1);
            assert.ok(doc1Properties.includes("@metadata"));
            assert.strictEqual(doc1Properties.length, 1);

            assert.ok(doc2);
            doc2Properties = Object.keys(doc2);
            assert.ok(doc2Properties.includes("@metadata"));
            assert.strictEqual(doc2Properties.length, 1);
        }
    });
});
