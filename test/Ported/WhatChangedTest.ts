import assert from "node:assert"
import { testContext, disposeTestDocumentStore } from "../Utils/TestUtil.js";

import {
    IDocumentStore,
} from "../../src/index.js";
import { User } from "../Assets/Entities.js";
import { assertThat } from "../Utils/AssertExtensions.js";

describe("WhatChangedTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("whatChangedNewField", async () => {
        {
            const newSession = store.openSession();
            const basicName = new BasicName();
            basicName.name = "Toli";
            await newSession.store(basicName, "users/1");

            assert.strictEqual(Object.keys(newSession.advanced.whatChanged()).length, 1);
            await newSession.saveChanges();
        }

        {
            const newSession = store.openSession();

            const user = await newSession.load<User>("users/1");
            user.age = 5;
            const changes = newSession.advanced.whatChanged();
            assert.strictEqual(changes["users/1"].length, 1);

            assert.strictEqual(changes["users/1"][0].change, "NewField");
            await newSession.saveChanges();
        }

    });

    it("whatChangedRemovedField", async () => {
        {
            const newSession = store.openSession();
            const nameAndAge = new NameAndAge();
            nameAndAge.age = 5;
            nameAndAge.name = "Toli";

            await newSession.store(nameAndAge, "users/1");

            const whatChanged = newSession.advanced.whatChanged();
            assert.strictEqual(Object.keys(whatChanged).length, 1);
            await newSession.saveChanges();
        }

        {
            const newSession = store.openSession();
            const ageOnly = await newSession.load<BasicAge>("users/1", BasicAge);

            // since in JS we do Object.assign() on an empty object when loading
            // 'name' prop is still there
            // 
            // to actually remove a field we can use delete though 
            delete ageOnly["name"];

            const changes = newSession.advanced.whatChanged()["users/1"];
            assert.strictEqual(changes.length, 1);

            assert.strictEqual(changes[0].change, "RemovedField");
            await newSession.saveChanges();
        }
    });

    it("whatChangedChangeField", async () => {
        {
            const newSession = store.openSession();
            const basicAge = new BasicAge();
            basicAge.age = 5;
            await newSession.store(basicAge, "users/1");

            assert.strictEqual(Object.keys(newSession.advanced.whatChanged()).length, 1);
            await newSession.saveChanges();
        }

        {
            const newSession = store.openSession();
            const user = await newSession.load<Int>("users/1", Int);

            // JS won't know how to load User into Int class,
            // we can do that manually though
            user.number = user["age"];
            delete user["age"];

            const changes = newSession.advanced.whatChanged();
            assert.strictEqual(changes["users/1"].length, 2);

            assert.strictEqual(changes["users/1"][0].change, "RemovedField");
            assert.strictEqual(changes["users/1"][1].change, "NewField");
            await newSession.saveChanges();
        }
    });

    it("whatChangedArrayValueChanged", async () => {
        {
            const newSession = store.openSession();
            const arr = new Arr();
            arr.array = ["a", 1, "b"];

            await newSession.store(arr, "users/1");
            const changes = newSession.advanced.whatChanged();

            assert.strictEqual(Object.keys(changes).length, 1);

            assert.strictEqual(changes["users/1"].length, 1);
            assert.strictEqual(changes["users/1"][0].change, "DocumentAdded");

            await newSession.saveChanges();
        }

        {
            const newSession = store.openSession();
            const arr = await newSession.load<Arr>("users/1");
            arr.array = ["a", 2, "c"];

            const changes = newSession.advanced.whatChanged();
            assert.strictEqual(Object.keys(changes).length, 1);

            assert.strictEqual(changes["users/1"].length, 2);

            assert.strictEqual(changes["users/1"][0].change, "ArrayValueChanged");
            assert.strictEqual(changes["users/1"][0].fieldOldValue.toString(), "1");
            assert.strictEqual(changes["users/1"][0].fieldNewValue, 2);

            assert.strictEqual(changes["users/1"][1].change, "ArrayValueChanged");
            assert.strictEqual(changes["users/1"][1].fieldOldValue, "b");
            assert.strictEqual(changes["users/1"][1].fieldNewValue, "c");
        }
    });

    it("whatChangedArrayValueAdded", async () => {
        {
            const newSession = store.openSession();
            const arr = new Arr();
            arr.array = ["a", 1, "b"];
            await newSession.store(arr, "arr/1");
            await newSession.saveChanges();
        }

        {
            const newSession = store.openSession();
            const arr = await newSession.load<Arr>("arr/1", Arr);
            arr.array = ["a", 1, "b", "c", 2];
            const changes = newSession.advanced.whatChanged();

            assert.strictEqual(Object.keys(changes).length, 1);
            assert.strictEqual(changes["arr/1"].length, 2);

            assert.strictEqual(changes["arr/1"][0].change, "ArrayValueAdded");
            assert.strictEqual(changes["arr/1"][0].fieldNewValue, "c");
            assert.ok(!changes["arr/1"][0].fieldOldValue);

            assert.strictEqual(changes["arr/1"][1].change, "ArrayValueAdded");
            assert.strictEqual(changes["arr/1"][1].fieldNewValue, 2);
            assert.ok(!changes["arr/1"][1].fieldOldValue);
        }
    });

    it("whatChangedArrayValueRemoved", async () => {
        {
            const newSession = store.openSession();
            const arr = new Arr();
            arr.array = ["a", 1, "b"];
            await newSession.store(arr, "arr/1");
            await newSession.saveChanges();
        }

        {
            const newSession = store.openSession();
            const arr = await newSession.load<Arr>("arr/1", Arr);
            arr.array = ["a"];
            const changes = newSession.advanced.whatChanged();

            assert.strictEqual(Object.keys(changes).length, 1);
            assert.strictEqual(changes["arr/1"].length, 2);

            assert.strictEqual(changes["arr/1"][0].change, "ArrayValueRemoved");
            assert.strictEqual(changes["arr/1"][0].fieldOldValue, 1);
            assert.ok(!changes["arr/1"][0].fieldNewValue);

            assert.strictEqual(changes["arr/1"][1].change, "ArrayValueRemoved");
            assert.strictEqual(changes["arr/1"][1].fieldOldValue, "b");
            assert.ok(!changes["arr/1"][1].fieldNewValue);
        }
    });

    it("RavenDB-8169", async () => {
        //Test that when old and new values are of different type
        //but have the same value, we consider them unchanged
        {
            const newSession = store.openSession();
            const anInt = new Int();
            anInt.number = 1;
            await newSession.store(anInt, "num/1");
            await newSession.saveChanges();
            const aDouble = new Double();
            aDouble.number = 2.0;
            await newSession.store(aDouble, "num/2");
            await newSession.saveChanges();
        }

        {
            const newSession = store.openSession();
            await newSession.load<Double>("num/1", Double);
            const changes = newSession.advanced.whatChanged();
            assert.strictEqual(Object.keys(changes).length, 0);
        }

        {
            const newSession = store.openSession();
            await newSession.load<Int>("num/2", Int);
            const changes = newSession.advanced.whatChanged();
            assert.strictEqual(Object.keys(changes).length, 0);
        }
    });

    it("whatChangedShouldBeIdempotentOperation", async () => {
        //RavenDB-9150
        {
            const session = store.openSession();
            let user1 = new User();
            user1.name = "user1";
            let user2 = new User();
            user2.name = "user2";
            user2.age = 1;
            const user3 = new User();
            user3.name = "user3";
            user3.age = 1;
            await session.store(user1, "users/1");
            await session.store(user2, "users/2");
            await session.store(user3, "users/3");

            assert.strictEqual(Object.keys(session.advanced.whatChanged()).length, 3);
            await session.saveChanges();

            user1 = await session.load<User>("users/1", User);
            user2 = await session.load<User>("users/2", User);
            user1.age = 10;
            await session.delete(user2);
            assert.strictEqual(Object.keys(session.advanced.whatChanged()).length, 2);
            assert.strictEqual(Object.keys(session.advanced.whatChanged()).length, 2);
        }
    });

    it("has changes", async () => {
        {
            const session = store.openSession();
            const user1 = new User();
            user1.name = "user1";

            const user2 = new User();
            user2.name = "user2";
            user2.age = 1;

            await session.store(user1, "users/1");
            await session.store(user2, "users/2");
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            assert.ok(!session.advanced.hasChanges());

            const u1 = await session.load<User>("users/1", User);
            const u2 = await session.load<User>("users/2", User);

            assert.ok(!session.advanced.hasChanged(u1));
            assert.ok(!session.advanced.hasChanged(u2));

            u1.name = "new name";
            assert.ok(session.advanced.hasChanged(u1));
            assert.ok(!session.advanced.hasChanged(u2));
            assert.ok(session.advanced.hasChanges());

        }
    });

    it("what_Changed_For_Delete_After_Change_Value", async () => {
        //RavenDB-13501

        {
            const session = store.openSession();

            const id = "ABC";
            let o = new TestObject();
            o.id = id;
            o.a = "A";
            o.b = "B";
            await session.store(o);
            await session.saveChanges();

            assertThat(session.advanced.hasChanges()).isFalse();

            o = await session.load(id, TestObject);
            o.a = "B";
            o.b = "C";
            await session.delete(o);

            const whatChangedFor = session.advanced.whatChangedFor(o);
            assertThat(whatChangedFor.length === 1 && whatChangedFor[0].change === "DocumentDeleted")
                .isTrue();

            await session.saveChanges();

            o = await session.load(id, TestObject);
            assertThat(o)
                .isNull();
        }
    })

    // We don't support whatChanged for metadata
    it.skip("what_Changed_For_RemovingAndAddingSameAmountOfFieldsToObjectShouldWork", async () => {
        const docId = "d/1";

        {
            const session = store.openSession();
            const d = new Doc();
            await session.store(d, docId);

            const meta = session.advanced.getMetadataFor(d);

            meta["Test-A"] = ["a", "a", "a"];
            meta["Test-B"] = ["c", "c", "c"];
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const d = await session.load(docId, Doc);
            const meta = session.advanced.getMetadataFor(d);

            meta["Test-A"] = ["b", "a", "c"];

            const changes = session.advanced.whatChangedFor(d);
            assertThat(changes)
                .hasSize(2);
            assertThat(changes[0].change)
                .isEqualTo("ArrayValueChanged");
            assertThat(changes[0].fieldName)
                .isEqualTo("Test-A");
            assertThat(changes[1].change)
                .isEqualTo("ArrayValueChanged");
            assertThat(changes[1].fieldName)
                .isEqualTo("Test-A");
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const d = await session.load(docId, Doc);
            const meta = session.advanced.getMetadataFor(d);

            delete meta["Test-A"];

            const changes = session.advanced.whatChangedFor(d);
            assertThat(changes)
                .hasSize(1);
            assertThat(changes[0].change)
                .isEqualTo("RemovedField");
        }

        {
            const session = store.openSession();
            const d = await session.load(docId, Doc);
            const meta = session.advanced.getMetadataFor(d);

            delete meta["Test-A"];
            delete meta["Test-C"];
            meta["Test-B"] = ["b", "b", "b"];
            meta["Test-D"] = ["d", "d", "d"];

            const changes = session.advanced.whatChangedFor(d);

            assertThat(changes)
                .hasSize(4);
            assertThat(changes.find(x => x.fieldName === "Test-A").change)
                .isEqualTo("RemovedField");
            assertThat(changes.find(x => x.fieldName === "Test-C").change)
                .isEqualTo("RemovedField");
            assertThat(changes.find(x => x.fieldName === "Test-B").change)
                .isEqualTo("NewField");
            assertThat(changes.find(x => x.fieldName === "Test-D").change)
                .isEqualTo("NewField");
        }

        {
            const session = store.openSession();
            const d = await session.load(docId, Doc);
            const meta = session.advanced.getMetadataFor(d);

            delete meta["Test-A"];
            meta["Test-B"] = ["b", "b", "b"];

            const changes = session.advanced.whatChangedFor(d);
            assertThat(changes.find(x => x.fieldName === "Test-A").change)
                .isEqualTo("RemovedField");
            assertThat(changes.find(x => x.fieldName === "Test-B").change)
                .isEqualTo("NewField");
        }
    });

    it("whatChanged_RemovedFieldFromDictionary", async () => {
        {
            const session = store.openSession();
            const entity = new Entity();
            entity.someData.set("Key", "Value");
            await session.store(entity, "entities/1");
            await session.saveChanges()
        }

        {
            const session = store.openSession();
            const entity = await session.load("entities/1", Entity);
            entity.someData.delete("Key");

            const changes = session.advanced.whatChanged()["entities/1"];
            assertThat(changes)
                .hasSize(1);

            assertThat(changes[0].change)
                .isEqualTo("ArrayValueRemoved"); // in node.js we serialize maps as arrays of tuples
            assertThat(changes[0].fieldName)
                .isEqualTo("someData");
            assertThat(changes[0].fieldOldValue[0])
                .isEqualTo("Key");
            assertThat(changes[0].fieldOldValue[1])
                .isEqualTo("Value");
            assertThat(changes[0].fieldNewValue)
                .isNull();
        }
    })
});


class TestObject {
    public id: string;
    public a: string;
    public b: string;
}

class Doc {
    public id: string;
}

class Entity {
    public someData = new Map<string, string>();
}

class BasicName {
    public name: string;
}

class NameAndAge {
    public name: string;
    public age: number;
}

class BasicAge {
    public age: number;
}

class Int {
    public number: number;
}

class Double {
    public number: number;
}

class Arr {
    public array: any[];
}
