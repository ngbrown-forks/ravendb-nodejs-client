import { Company, Order, User } from "../../Assets/Entities.js";
import assert from "node:assert"
import { testContext, disposeTestDocumentStore } from "../../Utils/TestUtil.js";

import {
    IDocumentStore,
    SubscriptionWorkerOptions,
    SubscriptionBatch,
    SubscriptionCreationOptions,
    SubscriptionWorker,
    ToggleOngoingTaskStateOperation,
    SubscriptionUpdateOptions,
    GetOngoingTaskInfoOperation,
    OngoingTaskSubscription,
    ObjectUtil,
    DocumentStore
} from "../../../src/index.js";
import { AsyncQueue } from "../../Utils/AsyncQueue.js";
import { acquireSemaphore } from "../../../src/Utility/SemaphoreUtil.js";
import { getError, throwError } from "../../../src/Exceptions/index.js";
import { TypeUtil } from "../../../src/Utility/TypeUtil.js";
import { assertThat, assertThrows } from "../../Utils/AssertExtensions.js";
import { TimeValue } from "../../../src/Primitives/TimeValue.js";
import { Semaphore } from "../../../src/Utility/Semaphore.js";
import { addDays } from "date-fns";

describe("SubscriptionsBasicTest", function () {
    const _reasonableWaitTime = 15 * 1000;
    this.timeout(5 * _reasonableWaitTime);

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canDisableSubscriptionViaApi", async () => {
        const subscription = await store.subscriptions.create(User);

        await store.subscriptions.disable(subscription);

        let subscriptions = await store.subscriptions.getSubscriptions(0, 10);
        assertThat(subscriptions[0].disabled)
            .isTrue();

        await store.subscriptions.enable(subscription);

        subscriptions = await store.subscriptions.getSubscriptions(0, 10);
        assertThat(subscriptions[0].disabled)
            .isFalse();
    });

    it("can delete subscription", async function() {
        const id1 = await store.subscriptions.create(User);
        const id2 = await store.subscriptions.create(User);

        let subscriptions = await store.subscriptions.getSubscriptions(0, 5);

        assert.strictEqual(subscriptions.length, 2);

        // test getSubscriptionState as well
        const subscriptionState = await store.subscriptions.getSubscriptionState(id1);
        assert.ok(!subscriptionState.changeVectorForNextBatchStartingPoint);

        await store.subscriptions.delete(id1);
        await store.subscriptions.delete(id2);

        subscriptions = await store.subscriptions.getSubscriptions(0, 5);
        assert.strictEqual(subscriptions.length, 0);
    });

    it("should throw when opening no existing subscription", async function() {
        const subscription = store.subscriptions.getSubscriptionWorker<any>({
            subscriptionName: "1",
            maxErroneousPeriod: 3000
        });

        try {

            subscription.on("batch", (batch, cb) => cb()); // this triggers subscription to run
            const error = await new Promise<Error>((resolve, reject) => {
                subscription.on("error", err => {
                    resolve(err);
                });
            });

            assert.strictEqual(
                error.name, "SubscriptionDoesNotExistException", "Expected another error but got:" + error.stack);

        } finally {
            subscription.dispose();
        }
    });

    it("should throw on attempt to open already opened subscription", async function() {
        const id = await store.subscriptions.create(User);

        const subscription = store.subscriptions.getSubscriptionWorker<any>({
            subscriptionName: id,
            maxErroneousPeriod: 3000
        });

        try {
            const session = store.openSession();
            await session.store(new User());
            await session.saveChanges();

            const changesList = new AsyncQueue<SubscriptionBatch<any>>();

            subscription.on("batch", x => changesList.push(x));

            const value = await changesList.poll(_reasonableWaitTime);
            assert.ok(value);

            {
                const secondSubscription = store.subscriptions.getSubscriptionWorker({
                    subscriptionName: id,
                    strategy: "OpenIfFree"
                });
                try {

                    secondSubscription.on("batch", () => {
                        assert.fail("We shouldn't get any data as subscription is occupied");
                    });

                    await new Promise<void>(resolve => {
                        secondSubscription.on("error", ex => {
                            assert.strictEqual(ex.name, "SubscriptionInUseException");
                            resolve();
                        });
                    });
                } finally {
                    secondSubscription.dispose();
                }
            }
        } finally {
            subscription.dispose();
        }
    });

    function subscriptionFailed(subscription) {
        let errReject;
        const errPromise = new Promise((_, reject) => errReject = reject);
        subscription.on("error", err => errReject(err));
        subscription.on("connectionRetry", err => {
            if (!err.canReconnect) {
                return errReject(err);
            }
        });
        return errPromise;
    }

    it("should stream all documents after subscription creation", async function () {
        store.initialize();
        {
            const session = store.openSession();
            const user1 = new User();
            user1.age = 31;
            await session.store(user1, "users/1");

            const user2 = new User();
            user2.age = 27;
            await session.store(user2, "users/12");

            const user3 = new User();
            user3.age = 25;
            await session.store(user3, "users/3");

            await session.saveChanges();
        }

        const id = await store.subscriptions.create(User);

        const subscription = store.subscriptions.getSubscriptionWorker<User>({
            subscriptionName: id,
            documentType: User,
            maxErroneousPeriod: 0,
            timeToWaitBeforeConnectionRetry: 0
        });

        const keys = new AsyncQueue<string>();
        const ages = new AsyncQueue<number>();
        try {

            subscription.on("batch", (batch, callback) => {
                try {
                    for (const x of batch.items) keys.push(x.id);
                    for (const x of batch.items) ages.push(x.rawResult.age);
                    callback();
                } catch (err) {
                    callback(err);
                }
            });


            await Promise.race([ subscriptionFailed(subscription), assertResults() ]);
        } finally {
            subscription.dispose();
        }

        async function assertResults() {
            assert.strictEqual(await keys.poll(_reasonableWaitTime), "users/1");
            assert.strictEqual(await keys.poll(_reasonableWaitTime), "users/12");
            assert.strictEqual(await keys.poll(_reasonableWaitTime), "users/3");

            assert.strictEqual(await ages.poll(_reasonableWaitTime), 31);
            assert.strictEqual(await ages.poll(_reasonableWaitTime), 27);
            assert.strictEqual(await ages.poll(_reasonableWaitTime), 25);
        }
    });

    it("can handle nested object types correctly", async function() {
        const id = await store.subscriptions.create(Order);

        const subscription = store.subscriptions.getSubscriptionWorker<Order>({
            subscriptionName: id,
            documentType: Order,
            maxErroneousPeriod: 0,
            timeToWaitBeforeConnectionRetry: 0
        });

        const orders = new AsyncQueue<Order>();

        {
            const session = store.openSession();
            const order = new Order();
            order.company = "company/1";
            order.orderedAt = new Date();
            await session.store(order, "orders/1");
            await session.saveChanges();
        }

        subscription.on("batch", (batch, callback) => {
            for (const x of batch.items) {
                orders.push(x.result);
            }
            callback();
        });

        try {
            await Promise.race([ subscriptionFailed(subscription), assertResults() ]);
        } finally {
            subscription.dispose();
        }

        async function assertResults() {
            const firstOrder = await orders.poll(_reasonableWaitTime);
            assertThat(firstOrder instanceof Order)
                .isTrue();
            assertThat(firstOrder.orderedAt instanceof Date)
                .isTrue();
        }
    })

    it("should send all new and modified docs", async function() {
        const id = await store.subscriptions.create(User);

        const subscription = store.subscriptions.getSubscriptionWorker<User>({
            subscriptionName: id,
            documentType: User,
            maxErroneousPeriod: 0,
            timeToWaitBeforeConnectionRetry: 0
        });

        const names = new AsyncQueue<string>();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "James";
            await session.store(user, "users/1");
            await session.saveChanges();
        }

        subscription.on("batch", (batch, callback) => {
            for (const x of batch.items) {
                names.push(x.result.name);
            }
            callback();
        });

        try {
            await Promise.race([ subscriptionFailed(subscription), assertResults() ]);
        } finally {
            subscription.dispose();
        }

        async function assertResults() {
            let name = await names.poll(_reasonableWaitTime);
            assert.strictEqual(name, "James");

            {
                const session = store.openSession();
                const user = new User();
                user.name = "Adam";
                await session.store(user, "users/12");
                await session.saveChanges();
            }

            name = await names.poll(_reasonableWaitTime);
            assert.strictEqual(name, "Adam");

            {
                const session = store.openSession();
                const user = new User();
                user.name = "David";
                await session.store(user, "users/1");
                await session.saveChanges();
            }

            name = await names.poll(_reasonableWaitTime);
            assert.strictEqual(name, "David");
        }
    });

    it("should respect max doc count in batch", async function () {
        {
            const session = store.openSession();
            for (let i = 0; i < 100; i++) {
                await session.store(new Company());
            }
            await session.saveChanges();
        }

        const id = await store.subscriptions.create(Company);
        const options = {
            subscriptionName: id,
            maxDocsPerBatch: 25,
            maxErroneousPeriod: 3000
        } as SubscriptionWorkerOptions<Company>;

        const subscriptionWorker = store.subscriptions.getSubscriptionWorker(options);

        try {
            let totalItems = 0;

            await new Promise<void>((resolve, reject) => {
                subscriptionWorker.on("batch", (batch, callback) => {
                    totalItems += batch.getNumberOfItemsInBatch();

                    assert.ok(batch.getNumberOfItemsInBatch() <= 25);

                    if (totalItems === 100) {
                        resolve();
                    }

                    callback();
                });
                subscriptionWorker.on("error", reject);
                subscriptionWorker.on("connectionRetry", reject);
            });
        } finally {
            subscriptionWorker.dispose();
        }
    });

    it("should respect collection criteria", async function() {
        {
            const session = store.openSession();
            for (let i = 0; i < 100; i++) {
                await session.store(new Company());
                await session.store(new User());
            }

            await session.saveChanges();
        }

        const id = await store.subscriptions.create(User);

        const options = {
            subscriptionName: id,
            maxDocsPerBatch: 31,
            maxErroneousPeriod: 3000
        } as SubscriptionWorkerOptions<User>;

        const subscription = store.subscriptions.getSubscriptionWorker(options);

        try {
            let integer = 0;

            await new Promise<void>((resolve, reject) => {
                subscription.on("error", reject);
                subscription.on("connectionRetry", reject);
                subscription.on("batch", (batch, callback) => {
                    integer += batch.getNumberOfItemsInBatch();

                    if (integer === 100) {
                        resolve();
                    }
                    callback();
                });
            });
        } finally {
            subscription.dispose();
        }
    });

    it("can disable subscription", async () => {
        {
            const session = store.openSession();
            for (let i = 0; i < 10; i++) {
                await session.store(new Company());
                await session.store(new User());
            }
            await session.saveChanges();
        }

        const id = await store.subscriptions.create(User);

        let subscriptionTask = await store.maintenance.send(new GetOngoingTaskInfoOperation(id, "Subscription")) as OngoingTaskSubscription;

        assertThat(subscriptionTask)
            .isNotNull();
        assertThat(subscriptionTask.taskType)
            .isEqualTo("Subscription");
        assertThat(subscriptionTask.responsibleNode)
            .isNotNull();

        await store.maintenance.send(new ToggleOngoingTaskStateOperation(subscriptionTask.taskId, "Subscription", true));

        subscriptionTask = await store.maintenance.send(new GetOngoingTaskInfoOperation(id, "Subscription")) as OngoingTaskSubscription;
        assertThat(subscriptionTask)
            .isNotNull();
        assertThat(subscriptionTask.disabled)
            .isTrue();
    });

    it("will acknowledge empty batches", async function() {
        const subscriptionDocuments = await store.subscriptions.getSubscriptions(0, 10);

        assert.strictEqual(subscriptionDocuments.length, 0);

        const allId = await store.subscriptions.create(User);

        const allSubscription = store.subscriptions.getSubscriptionWorker(allId);
        try {
            const allSemaphore = new Semaphore();
            allSemaphore.take(TypeUtil.NOOP);

            let allCounter = 0;

            const filteredOptions = {
                query: "from Users where age < 0"
            } as SubscriptionCreationOptions;

            const filteredUsersId = await store.subscriptions.create(filteredOptions);

            const filteredUsersSubscription = store.subscriptions.getSubscriptionWorker({
                subscriptionName: filteredUsersId
            });

            try {
                let usersDocs = false;

                {
                    const session = store.openSession();
                    for (let i = 0; i < 500; i++) {
                        await session.store(new User(), "another/");
                    }
                    await session.saveChanges();
                }

                allSubscription.on("batch", (batch, callback) => {
                    allCounter += batch.getNumberOfItemsInBatch();

                    if (allCounter >= 500) {
                        allSemaphore.leave();
                    }

                    callback();
                });

                filteredUsersSubscription.on("batch", (batch, callback) => {
                    usersDocs = true;
                    callback();
                });

                await Promise.race([
                    acquireSemaphore(allSemaphore).promise,
                    subscriptionFailed(allSubscription),
                    subscriptionFailed(filteredUsersSubscription)
                ]);

                assert.ok(!usersDocs);
            } finally {
                filteredUsersSubscription.dispose();
            }
        } finally {
            allSubscription.dispose();
        }
    });

    it("can release subscription", async function() {
        let subscriptionWorker: SubscriptionWorker<any>;
        let throwingSubscriptionWorker: SubscriptionWorker<any>;
        let notThrowingSubscriptionWorker: SubscriptionWorker<any>;

        try {
            const id = await store.subscriptions.create(User);

            const options1 = {
                subscriptionName: id,
                strategy: "OpenIfFree",
                maxErroneousPeriod: 3000
            } as SubscriptionWorkerOptions<User>;

            subscriptionWorker = store.subscriptions.getSubscriptionWorker(options1);

            const mre = new Semaphore(1);
            mre.take(TypeUtil.NOOP); // block by default

            await putUserDoc(store);

            subscriptionWorker.on("error", TypeUtil.NOOP);

            subscriptionWorker.on("batch", (batch, callback) => {
                mre.leave(1);
                callback();
            });

            await acquireSemaphore(mre, { timeout: _reasonableWaitTime }).promise;
            mre.leave();

            const options2 = {
                subscriptionName: id,
                strategy: "OpenIfFree",
                maxErroneousPeriod: 3000
            } as SubscriptionWorkerOptions<User>;

            throwingSubscriptionWorker = store.subscriptions.getSubscriptionWorker(options2);

            await new Promise<void>(resolve => {
                throwingSubscriptionWorker.on("error", error => {
                    assert.strictEqual(error.name, "SubscriptionInUseException");
                    resolve();
                });

                throwingSubscriptionWorker.on("batch", (batch, callback) => {
                    callback();
                });
            });

            await store.subscriptions.dropConnection(id);

            notThrowingSubscriptionWorker = store.subscriptions.getSubscriptionWorker({
                subscriptionName: id,
                maxErroneousPeriod: 3000
            });

            notThrowingSubscriptionWorker.on("batch", (batch, callback) => {
                mre.leave(1);
                callback();
            });

            await putUserDoc(store);

            await acquireSemaphore(mre, { timeout: _reasonableWaitTime });
        } finally {
            if (subscriptionWorker) {
                subscriptionWorker.dispose();
            }
            if (throwingSubscriptionWorker) {
                throwingSubscriptionWorker.dispose();
            }
            if (notThrowingSubscriptionWorker) {
                notThrowingSubscriptionWorker.dispose();
            }
        }
    });

    const putUserDoc = async (store: IDocumentStore) => {
        const session = store.openSession();
        await session.store(new User());
        await session.saveChanges();
    };

    it("should pull documents after bulk insert", async function() {
        const id = await store.subscriptions.create(User);

        const subscription = store.subscriptions.getSubscriptionWorker<User>({
            subscriptionName: id,
            documentType: User,
            maxErroneousPeriod: 3000
        });

        try {
            const docs = new AsyncQueue<User>();

            const bulk = store.bulkInsert();
            {
                await bulk.store(new User());
                await bulk.store(new User());
                await bulk.store(new User());
                await bulk.finish();
            }

            subscription.on("batch", (batch, callback) => {
                for (const i of batch.items) docs.push(i.result);
                callback();
            });

            assert.ok(await Promise.race([
                docs.poll(_reasonableWaitTime),
                subscriptionFailed(subscription)
            ]));
            assert.ok(await Promise.race([
                docs.poll(_reasonableWaitTime),
                subscriptionFailed(subscription)
            ]));
        } finally {
            subscription.dispose();
        }
    });

    //RavenDB-15919
    it.skip("should stop pulling docs and close subscription on subscriber error by default", async function() {
        const id = await store.subscriptions.create(User);

        const subscription = store.subscriptions.getSubscriptionWorker({
            subscriptionName: id,
            maxErroneousPeriod: 3000
        });

        await putUserDoc(store);

        try {
            subscription.on("batch", (batch, callback) => {
                throwError("InvalidOperationException", "Fake exception");
                callback();
            });

            await new Promise<void>(resolve => {
                subscription.on("error", error => {
                    assert.strictEqual(error.name, "SubscriberErrorException");
                    resolve();
                });
            });

            const subscriptionConfig = (await store.subscriptions.getSubscriptions(0, 1))[0];
            assert.ok(!subscriptionConfig.changeVectorForNextBatchStartingPoint);
        } finally {
            subscription.dispose();
        }
    });

    it("can set to ignore subscriber errors", async function() {
        const id = await store.subscriptions.create(User);

        const options1 = {
            ignoreSubscriberErrors: true,
            subscriptionName: id,
            documentType: User,
            maxErroneousPeriod: 3000
        } as SubscriptionWorkerOptions<User>;

        const subscription = store.subscriptions.getSubscriptionWorker(options1);
        try {
            const docs = new AsyncQueue<User>();

            await putUserDoc(store);
            await putUserDoc(store);

            let hasError = false;

            subscription.on("error", () => {
                hasError = true;
            });

            subscription.on("batch", (batch, callback) => {
                for (const i of batch.items) docs.push(i.result);
                callback(getError("InvalidOperationException", "Fake exception"));
            });

            assert.ok(await docs.poll(_reasonableWaitTime));
            assert.ok(await docs.poll(_reasonableWaitTime));
            assert.ok(!hasError);
        } finally {
            subscription.dispose();
        }
    });

    it("RavenDB-3452 should should stop pulling docs if released", async function() {
        const id = await store.subscriptions.create(User);

        const options1 = {
            subscriptionName: id,
            timeToWaitBeforeConnectionRetry: 1000,
            documentType: User,
            maxErroneousPeriod: 3000
        } as SubscriptionWorkerOptions<User>;

        const subscription = store.subscriptions.getSubscriptionWorker(options1);

        try {
            {
                const session = store.openSession();
                await session.store(new User(), "users/1");
                await session.store(new User(), "users/12");
                await session.saveChanges();
            }

            const docs = new AsyncQueue<User>();

            subscription.on("batch", (batch, callback) => {
                for (const i of batch.items) docs.push(i.result);
                callback();
            });

            assert.ok(await docs.poll(_reasonableWaitTime));
            assert.ok(await docs.poll(_reasonableWaitTime));

            // eslint-disable-next-line no-async-promise-executor
            await new Promise<void>(async resolve => {
                subscription.on("error", error => {
                    assert.strictEqual(error.name, "SubscriptionClosedException");
                    resolve();
                });

                await store.subscriptions.dropConnection(id);
            });

            {
                const session = store.openSession();
                await session.store(new User(), "users/3");
                await session.store(new User(), "users/4");
                await session.saveChanges();
            }

            try {
                await docs.poll(50);
                assert.fail("Should have thrown");
                await docs.poll(50);
            } catch (err) {
                assert.strictEqual(err.name, "TimeoutException");
            }
        } finally {
            subscription.dispose();
        }
    });

    it("RavenDB-3453 should deserialize the whole documents after typed subscription", async function() {
        const id = await store.subscriptions.create(User);
        const subscription = store.subscriptions.getSubscriptionWorker<User>({
            documentType: User,
            subscriptionName: id,
            maxErroneousPeriod: 3000
        });

        try {
            const users = new AsyncQueue<User>();

            {
                const session = store.openSession();
                const user1 = new User();
                user1.age = 31;
                await session.store(user1, "users/1");

                const user2 = new User();
                user2.age = 27;
                await session.store(user2, "users/12");

                const user3 = new User();
                user3.age = 25;
                await session.store(user3, "users/3");

                await session.saveChanges();
            }

            subscription.on("batch", (batch, callback) => {
                for (const i of batch.items) users.push(i.result);
                callback();
            });

            let user: User;
            user = await users.poll(_reasonableWaitTime);
            assert.ok(user);
            assert.strictEqual(user.id, "users/1");
            assert.strictEqual(user.age, 31);

            user = await users.poll(_reasonableWaitTime);
            assert.ok(user);
            assert.strictEqual(user.id, "users/12");
            assert.strictEqual(user.age, 27);

            user = await users.poll(_reasonableWaitTime);
            assert.ok(user);
            assert.strictEqual(user.id, "users/3");
            assert.strictEqual(user.age, 25);
        } finally {
            subscription.dispose();
        }
    });

    it("disposing one subscription should not affect on notifications of others", async function() {
        let subscription1: SubscriptionWorker<User>;
        let subscription2: SubscriptionWorker<User>;

        try {
            const id1 = await store.subscriptions.create(User);
            const id2 = await store.subscriptions.create(User);

            {
                const session = store.openSession();
                await session.store(new User(), "users/1");
                await session.store(new User(), "users/2");
                await session.saveChanges();
            }

            subscription1 = store.subscriptions.getSubscriptionWorker<User>({
                subscriptionName: id1,
                documentType: User
            });
            const items1 = new AsyncQueue<User>();
            subscription1.on("batch", (batch, callback) => {
                for (const i of batch.items) items1.push(i.result);
                callback();
            });

            subscription2 = store.subscriptions.getSubscriptionWorker<User>({
                subscriptionName: id2,
                documentType: User
            });
            const items2 = new AsyncQueue<User>();
            subscription2.on("batch", (batch, callback) => {
                for (const i of batch.items) items2.push(i.result);
                callback();
            });

            let user = await items1.poll(_reasonableWaitTime);
            assert.ok(user);
            assert.strictEqual(user.id, "users/1");

            user = await items1.poll(_reasonableWaitTime);
            assert.ok(user);
            assert.strictEqual(user.id, "users/2");

            user = await items2.poll(_reasonableWaitTime);
            assert.ok(user);
            assert.strictEqual(user.id, "users/1");

            user = await items2.poll(_reasonableWaitTime);
            assert.ok(user);
            assert.strictEqual(user.id, "users/2");

            subscription1.dispose();

            {
                const session = store.openSession();
                await session.store(new User(), "users/3");
                await session.store(new User(), "users/4");
                await session.saveChanges();
            }

            user = await items2.poll(_reasonableWaitTime);
            assert.ok(user);
            assert.strictEqual(user.id, "users/3");

            user = await items2.poll(_reasonableWaitTime);
            assert.ok(user);
            assert.strictEqual(user.id, "users/4");
        } finally {
            if (subscription1) {
                subscription1.dispose();
            }
            if (subscription2) {
                subscription2.dispose();
            }
        }
    });

    it("test subscription with PascalCasing", async function() {
        const store2 = new DocumentStore(store.urls, store.database);
        try {
            store2.conventions.findCollectionNameForObjectLiteral = () => "test";
            store2.conventions.serverToLocalFieldNameConverter = ObjectUtil.camel;
            store2.conventions.localToServerFieldNameConverter = ObjectUtil.pascal;
            store2.initialize();

            {
                const session = store2.openSession();
                const user1 = { age: 31, name: "John" };
                await session.store(user1);
                const user2 = { age: 18, name: "Marika" };
                await session.store(user2);
                const user3 = { age: 26, name: "Meluzyna" };
                await session.store(user3);

                await session.saveChanges();
            }

            const id = await store2.subscriptions.create({
                query: "from test"
            });

            const subscription = store2.subscriptions.getSubscriptionWorker({
                subscriptionName: id,
            });

            try {
                let batch;
                await new Promise<void>((resolve, reject) => {
                    subscription.on("error", reject);
                    subscription.on("connectionRetry", reject);
                    subscription.on("batch", (_batch, callback) => {
                        batch = _batch;
                        callback();
                        resolve();
                    });
                });

                assert.ok(batch);
                assert.strictEqual(batch.items.length, 3);
                assert.strictEqual(batch.items[0].rawResult.age, 31);
                assert.strictEqual(batch.items[0].rawResult.name, "John");
            } finally {
                subscription.dispose();
            }
        } finally {
            store2.dispose();
        }
    });

    it("canUpdateSubscriptionByName", async () => {
        const subscriptionCreationOptions: SubscriptionCreationOptions = {
            query: "from Users",
            name: "Created"
        };

        const subsId = await store.subscriptions.create(subscriptionCreationOptions);

        const subscriptions = await store.subscriptions.getSubscriptions(0, 5);

        const state = subscriptions[0];

        assertThat(subscriptions)
            .hasSize(1);

        assertThat(state.subscriptionName)
            .isEqualTo("Created");
        assertThat(state.query)
            .isEqualTo("from Users");

        const newQuery = "from Users where age > 18";

        const subscriptionUpdateOptions: SubscriptionUpdateOptions = {
            name: subsId,
            query: newQuery
        };

        await store.subscriptions.update(subscriptionUpdateOptions);

        const newSubscriptions = await store.subscriptions.getSubscriptions(0, 5);
        const newState = newSubscriptions[0];
        assertThat(newSubscriptions)
            .hasSize(1);
        assertThat(newState.subscriptionName)
            .isEqualTo(state.subscriptionName);
        assertThat(newState.query)
            .isEqualTo(newQuery);
        assertThat(newState.subscriptionId)
            .isEqualTo(state.subscriptionId);

    });

    it("canUpdateSubscriptionById", async () => {
        const subscriptionCreationOptions: SubscriptionCreationOptions = {
            query: "from Users",
            name: "Created"
        };

        await store.subscriptions.create(subscriptionCreationOptions);

        const subscriptions = await store.subscriptions.getSubscriptions(0, 5);

        const state = subscriptions[0];

        assertThat(subscriptions)
            .hasSize(1);
        assertThat(state.subscriptionName)
            .isEqualTo("Created");
        assertThat(state.query)
            .isEqualTo("from Users");

        const newQuery = "from Users where age > 18";

        const subscriptionUpdateOptions: SubscriptionUpdateOptions = {
            id: state.subscriptionId,
            query: newQuery
        };

        await store.subscriptions.update(subscriptionUpdateOptions);

        const newSubscriptions = await store.subscriptions.getSubscriptions(0, 5);
        const newState = newSubscriptions[0];
        assertThat(newSubscriptions)
            .hasSize(1);
        assertThat(newState.subscriptionName)
            .isEqualTo(state.subscriptionName);
        assertThat(newState.query)
            .isEqualTo(newQuery);
        assertThat(newState.subscriptionId)
            .isEqualTo(state.subscriptionId);
    });

    it("updateNonExistentSubscriptionShouldThrow", async () => {
        const name = "Update";
        const id = 322;

        await assertThrows(() => {
            const subscriptionUpdateOptions: SubscriptionUpdateOptions = {
                name
            };

            return store.subscriptions.update(subscriptionUpdateOptions);
        }, err => {
            assertThat(err.name)
                .isEqualTo("SubscriptionDoesNotExistException");
        });

        await assertThrows(() => {
            const subscriptionUpdateOptions: SubscriptionUpdateOptions = {
                name,
                id
            };

            return store.subscriptions.update(subscriptionUpdateOptions);
        }, err => {
            assertThat(err.name)
                .isEqualTo("SubscriptionDoesNotExistException");
        });

        const subscriptionCreationOptions: SubscriptionCreationOptions = {
            query: "from Users",
            name: "Created"
        };

        const subsId = await store.subscriptions.create(subscriptionCreationOptions);

        await assertThrows(() => {
            const subscriptionUpdateOptions: SubscriptionUpdateOptions = {
                name: subsId,
                id
            };

            return store.subscriptions.update(subscriptionUpdateOptions);
        }, err => {
            assertThat(err.name)
                .isEqualTo("SubscriptionDoesNotExistException");
        });
    });

    it("updateSubscriptionShouldReturnNotModified", async () => {
        const updateOptions: SubscriptionUpdateOptions = {
            query: "from Users",
            name: "Created"
        };

        await store.subscriptions.create(updateOptions);

        const subscriptions = await store.subscriptions.getSubscriptions(0, 5);

        const state = subscriptions[0];

        assertThat(subscriptions)
            .hasSize(1);
        assertThat(state.subscriptionName)
            .isEqualTo("Created");
        assertThat(state.query)
            .isEqualTo("from Users");

        await store.subscriptions.update(updateOptions);

        const newSubscriptions = await store.subscriptions.getSubscriptions(0, 5);
        const newState = newSubscriptions[0];

        assertThat(newSubscriptions)
            .hasSize(1);

        assertThat(newState.subscriptionName)
            .isEqualTo(state.subscriptionName);
        assertThat(newState.query)
            .isEqualTo(state.query);
        assertThat(newState.subscriptionId)
            .isEqualTo(state.subscriptionId);
    });

   it("canCreateSubscriptionWithIncludeTimeSeries_LastRangeByTime", async () => {
       const now = testContext.utcToday();

       const subscriptionCreationOptions: SubscriptionCreationOptions = {
           includes: builder => builder.includeTimeSeries("stockPrice", "Last", TimeValue.ofMonths(1)),
           documentType: Company
       };

       const name = await store.subscriptions.create(subscriptionCreationOptions);

       const worker = store.subscriptions.getSubscriptionWorker({
           subscriptionName: name,
           documentType: Company
       });

       const queue = new AsyncQueue();

       try {
           worker.on("batch", async (batch, callback) => {
               try {
                   const session = batch.openSession();
                   assertThat(session.advanced.numberOfRequests)
                       .isEqualTo(0);

                   const company = await session.load("companies/1", Company);
                   assertThat(session.advanced.numberOfRequests)
                       .isEqualTo(0);

                   const timeSeries = session.timeSeriesFor(company, "stockPrice");
                   const timeSeriesEntries = await timeSeries.get(addDays(now, -7), null);

                   assertThat(timeSeriesEntries)
                       .hasSize(1);
                   assertThat(timeSeriesEntries[0].timestamp.getTime())
                       .isEqualTo(now.getTime());
                   assertThat(timeSeriesEntries[0].value)
                       .isEqualTo(10);
                   assertThat(session.advanced.numberOfRequests)
                       .isEqualTo(0);

                   queue.push({});
                   callback();
               } catch (e) {
                   callback(e);
               }
           });

           {
               const session = store.openSession();
               const company = new Company();
               company.id = "companies/1";
               company.name = "HR";

               await session.store(company);

               session.timeSeriesFor(company, "stockPrice")
                   .append(now, 10);
               await session.saveChanges();
           }

           await Promise.race([queue.poll(_reasonableWaitTime), subscriptionFailed(worker)]);
       } finally {
           worker.dispose();
       }
   });

   it("canCreateSubscriptionWithIncludeTimeSeries_LastRangeByCount", async () => {
       const now = testContext.utcToday();

       const subscriptionCreationOptions: SubscriptionCreationOptions = {
           includes: builder => builder.includeTimeSeries("stockPrice", "Last", 32),
           documentType: Company
       };

       const name = await store.subscriptions.create(subscriptionCreationOptions);

       const worker = store.subscriptions.getSubscriptionWorker({
           subscriptionName: name,
           documentType: Company
       });

       const queue = new AsyncQueue();

       try {
           worker.on("batch", async (batch, callback) => {
               try {
                   const session = batch.openSession();
                   assertThat(session.advanced.numberOfRequests)
                       .isEqualTo(0);

                   const company = await session.load("companies/1", Company);
                   assertThat(session.advanced.numberOfRequests)
                       .isEqualTo(0);

                   const timeSeries = session.timeSeriesFor(company, "stockPrice");
                   const timeSeriesEntries = await timeSeries.get(
                       addDays(now, -7),
                       null
                   );

                   assertThat(timeSeriesEntries)
                       .hasSize(1);
                   assertThat(timeSeriesEntries[0].timestamp.getTime())
                       .isEqualTo(addDays(now, -7).getTime());
                   assertThat(timeSeriesEntries[0].value)
                       .isEqualTo(10);
                   assertThat(session.advanced.numberOfRequests)
                       .isEqualTo(0);

                   queue.push({});
                   callback();
               } catch (e) {
                   callback(e);
               }
           });

           {
               const session = store.openSession();
               const company = new Company();
               company.id = "companies/1";
               company.name = "HR";

               await session.store(company);

               session.timeSeriesFor(company, "stockPrice")
                   .append(addDays(now, -7), 10);
               await session.saveChanges();
           }

           await Promise.race([queue.poll(_reasonableWaitTime), subscriptionFailed(worker)]);
       } finally {
           worker.dispose();
       }
   });

   it("canCreateSubscriptionWithIncludeTimeSeries_Array_LastRange", async () => {
       const now = testContext.utcToday();

       const subscriptionCreationOptions: SubscriptionCreationOptions = {
           includes: builder => builder.includeTimeSeries(["stockPrice", "stockPrice2"], "Last", TimeValue.ofDays(7)),
           documentType: Company
       };

       const name = await store.subscriptions.create(subscriptionCreationOptions);

       const worker = store.subscriptions.getSubscriptionWorker({
           subscriptionName: name,
           documentType: Company
       });

       const queue = new AsyncQueue();

       try {
           worker.on("batch", async (batch, callback) => {
               try {
                   const session = batch.openSession();
                   assertThat(session.advanced.numberOfRequests)
                       .isEqualTo(0);

                   const company = await session.load("companies/1", Company);
                   assertThat(session.advanced.numberOfRequests)
                       .isEqualTo(0);

                   let timeSeries = session.timeSeriesFor(company, "stockPrice");
                   let timeSeriesEntries = await timeSeries.get(
                       addDays(now, -7),
                       null
                   );

                   assertThat(timeSeriesEntries)
                       .hasSize(1);
                   assertThat(timeSeriesEntries[0].timestamp.getTime())
                       .isEqualTo(addDays(now, -7).getTime());
                   assertThat(timeSeriesEntries[0].value)
                       .isEqualTo(10);
                   assertThat(session.advanced.numberOfRequests)
                       .isEqualTo(0);

                   timeSeries = session.timeSeriesFor(company, "stockPrice2");
                   timeSeriesEntries = await timeSeries.get(
                       addDays(now, -5),
                       null
                   );

                   assertThat(timeSeriesEntries)
                       .hasSize(1);
                   assertThat(timeSeriesEntries[0].timestamp.getTime())
                       .isEqualTo(addDays(now, -5).getTime());
                   assertThat(timeSeriesEntries[0].value)
                       .isEqualTo(100);
                   assertThat(session.advanced.numberOfRequests)
                       .isEqualTo(0);

                   queue.push({});
                   callback();
               } catch (e) {
                   callback(e);
               }
           });

           {
               const session = store.openSession();
               const company = new Company();
               company.id = "companies/1";
               company.name = "HR";

               await session.store(company);

               session.timeSeriesFor(company, "stockPrice")
                   .append(addDays(now, -7), 10);
               session.timeSeriesFor(company, "stockPrice2")
                   .append(addDays(now, -5), 100);
               await session.saveChanges();
           }

           await Promise.race([queue.poll(_reasonableWaitTime), subscriptionFailed(worker)]);
       } finally {
           worker.dispose();
       }
   });

   it("canCreateSubscriptionWithIncludeTimeSeries_All_LastRange", async () => {
       const now = testContext.utcToday();

       const subscriptionCreationOptions: SubscriptionCreationOptions = {
           includes: builder => builder.includeAllTimeSeries("Last", TimeValue.ofDays(7)),
           documentType: Company
       };

       const name = await store.subscriptions.create(subscriptionCreationOptions);

       const worker = store.subscriptions.getSubscriptionWorker({
           subscriptionName: name,
           documentType: Company
       });

       const queue = new AsyncQueue();

       try {
           worker.on("batch", async (batch, callback) => {
               try {
                   const session = batch.openSession();
                   assertThat(session.advanced.numberOfRequests)
                       .isEqualTo(0);

                   const company = await session.load("companies/1", Company);
                   assertThat(session.advanced.numberOfRequests)
                       .isEqualTo(0);

                   let timeSeries = session.timeSeriesFor(company, "stockPrice");
                   let timeSeriesEntries = await timeSeries.get(
                       addDays(now, -7),
                       null
                   );

                   assertThat(timeSeriesEntries)
                       .hasSize(1);
                   assertThat(timeSeriesEntries[0].timestamp.getTime())
                       .isEqualTo(addDays(now, -7).getTime());
                   assertThat(timeSeriesEntries[0].value)
                       .isEqualTo(10);
                   assertThat(session.advanced.numberOfRequests)
                       .isEqualTo(0);

                   timeSeries = session.timeSeriesFor(company, "stockPrice2");
                   timeSeriesEntries = await timeSeries.get(
                       addDays(now, -5),
                       null
                   );

                   assertThat(timeSeriesEntries)
                       .hasSize(1);
                   assertThat(timeSeriesEntries[0].timestamp.getTime())
                       .isEqualTo(addDays(now, -5).getTime());
                   assertThat(timeSeriesEntries[0].value)
                       .isEqualTo(100);
                   assertThat(session.advanced.numberOfRequests)
                       .isEqualTo(0);

                   queue.push({});
                   callback();
               } catch (e) {
                   callback(e);
               }
           });

           {
               const session = store.openSession();
               const company = new Company();
               company.id = "companies/1";
               company.name = "HR";

               await session.store(company);

               session.timeSeriesFor(company, "stockPrice")
                   .append(addDays(now, -7), 10);
               session.timeSeriesFor(company, "stockPrice2")
                   .append(addDays(now, -5), 100);
               await session.saveChanges();
           }

           await Promise.race([queue.poll(_reasonableWaitTime), subscriptionFailed(worker)]);
       } finally {
           worker.dispose();
       }
   });

    it("canUseEmoji", async () => {
        let user1: User;

        {
            const session = store.openSession();
            user1 = new User();
            user1.name = "user_\uD83D\uDE21\uD83D\uDE21\uD83E\uDD2C\uD83D\uDE00😡😡🤬😀";
            await session.store(user1, "users/1");
            await session.saveChanges();
        }

        const creationOptions: SubscriptionCreationOptions = {
            name: "name_\uD83D\uDE21\uD83D\uDE21\uD83E\uDD2C\uD83D\uDE00😡😡🤬😀",
            documentType: User
        };

        const id = await store.subscriptions.create(creationOptions);

        const subscription = store.subscriptions.getSubscriptionWorker({
            documentType: User,
            subscriptionName: id
        });

        const keys = new AsyncQueue<string>();

        try {
            subscription.on("batch", (batch, callback) => {
                for (const x of batch.items) keys.push(x.result.name);
                callback();
            });

            const key = await keys.poll(_reasonableWaitTime);
            assertThat(key)
                .isNotNull()
                .isEqualTo(user1.name);
        } finally {
            subscription.dispose();
        }
    });
});


// describe("Manual subscription tests", () => {

//     it.only("reconnection test", function (done) {
//         this.timeout(0);

//         const store = new DocumentStore("http://127.0.0.1:8080", "subs");
//         store.initialize();

//         const sub = store.subscriptions.getSubscriptionWorker({
//             subscriptionName: "sub1",
//         });

//         sub.on("batch", (batch, callback) => {
//             callback();
//         });

//         sub.on("error", (err) => {
//         });

//         sub.on("end", () => {
//             done();
//             store.dispose();
//         });
//     });
// });
