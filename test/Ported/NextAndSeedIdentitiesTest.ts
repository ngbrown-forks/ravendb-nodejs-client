import assert from "node:assert"
import { testContext, disposeTestDocumentStore } from "../Utils/TestUtil.js";

import {
    IDocumentStore,
    GetIdentitiesOperation,
} from "../../src/index.js";
import { User } from "../Assets/Entities.js";
import { NextIdentityForOperation } from "../../src/Documents/Operations/Identities/NextIdentityForOperation.js";
import { SeedIdentityForOperation } from "../../src/Documents/Operations/Identities/SeedIdentityForOperation.js";
import { assertThat } from "../Utils/AssertExtensions.js";

describe("NextAndSeedIdentitiesTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("NextIdentityForCommand should use one ID from pool", async () => {
        {
            const session = store.openSession();
            const user = Object.assign(new User(), { lastName: "Adi" });
            await session.store(user, "users|");
            await session.saveChanges();
        }

        await store.maintenance.send(new NextIdentityForOperation("users"));

        {
            const session = store.openSession();
            const user = Object.assign(new User(), { lastName: "Avivi" });
            await session.store(user, "users|");
            await session.saveChanges();
        }

        const identities = await store.maintenance.send(new GetIdentitiesOperation());
        assertThat(identities)
            .hasSize(1)
            .containsEntry("users|", 3);

        {
            const session = store.openSession();
            const entityWithId1 = await session.load<User>("users/1");
            const entityWithId2 = await session.load<User>("users/2");
            const entityWithId3 = await session.load<User>("users/3");
            const entityWithId4 = await session.load<User>("users/4");

            assert.ok(entityWithId1);
            assert.ok(entityWithId3);

            assert.ok(!entityWithId2);
            assert.ok(!entityWithId4);

            assert.strictEqual(entityWithId1.lastName, "Adi");
            assert.strictEqual(entityWithId3.lastName, "Avivi");
        }
    });

    it("SeedIdentityForCommand should set identity for given string", async () => {
        {
            const session = store.openSession();
            const user = Object.assign(new User(), { lastName: "Adi" });
            await session.store(user, "users|");
            await session.saveChanges();
        }

        const result1 = await store.maintenance.send(new SeedIdentityForOperation("users", 1990));
        assert.strictEqual(result1, 1990);

        {
            const session = store.openSession();
            const user = Object.assign(new User(), { lastName: "Avivi" });
            await session.store(user, "users|");
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const entityWithId1 = await session.load<User>("users/1");
            const entityWithId2 = await session.load<User>("users/2");
            const entityWithId1990 = await session.load<User>("users/1990");
            const entityWithId1991 = await session.load<User>("users/1991");
            const entityWithId1992 = await session.load<User>("users/1992");

            assert.ok(entityWithId1);
            assert.ok(entityWithId1991);

            assert.ok(!entityWithId2);
            assert.ok(!entityWithId1992);
            assert.ok(!entityWithId1990);

            assert.strictEqual(entityWithId1.lastName, "Adi");
            assert.strictEqual(entityWithId1991.lastName, "Avivi");
        }

        const result2 = await store.maintenance.send(new SeedIdentityForOperation("users", 1975));
        assert.strictEqual(result2, 1991);

        const result3 = await store.maintenance.send(new SeedIdentityForOperation("users", 1975, true));
        assert.strictEqual(result3, 1975);
    });

    it("nextIdentityForOperationShouldCreateANewIdentityIfThereIsNone", async () => {
        const session = store.openSession();
        const result = await store.maintenance.send(new NextIdentityForOperation("person|"));

        assert.strictEqual(result, 1);
    });
});