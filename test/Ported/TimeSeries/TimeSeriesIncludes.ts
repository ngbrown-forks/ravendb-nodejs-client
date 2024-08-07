import {
    GetMultipleTimeSeriesOperation,
    IDocumentStore,
    InMemoryDocumentSessionOperations,
    TimeSeriesRange
} from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { Company, Order } from "../../Assets/Entities.js";
import { assertThat, assertThrows } from "../../Utils/AssertExtensions.js";
import { TimeValue } from "../../../src/Primitives/TimeValue.js";
import { addHours, addMinutes, addSeconds } from "date-fns";

describe("TimeSeriesIncludesTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("sessionLoadWithIncludeTimeSeries", async () => {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();

            const company = new Company();
            company.name = "HR";
            await session.store(company, "companies/1-A");

            const order = new Order();
            order.company = "companies/1-A";
            await session.store(order, "orders/1-A");

            const tsf = session.timeSeriesFor("orders/1-A", "Heartrate");
            tsf.append(baseLine, 67, "watches/apple");
            tsf.append(addMinutes(baseLine, 5), 64, "watches/apple");
            tsf.append(addMinutes(baseLine, 10), 65, "watches/fitbit");

            await session.saveChanges();
        }

        {
            const session = store.openSession();

            const order = await session.load<Order>("orders/1-A", {
                documentType: Order,
                includes: i => i.includeDocuments("company").includeTimeSeries("Heartrate")
            });

            const company = await session.load<Company>(order.company, Company);
            assertThat(company.name)
                .isEqualTo("HR");

            // should not go to server
            const values = await session.timeSeriesFor(order, "Heartrate").get();

            assertThat(values)
                .hasSize(3);

            assertThat(values[0].values)
                .hasSize(1);
            assertThat(values[0].values[0])
                .isEqualTo(67);
            assertThat(values[0].tag)
                .isEqualTo("watches/apple");
            assertThat(values[0].timestamp.getTime())
                .isEqualTo(baseLine.getTime());
            assertThat(values[1].values)
                .hasSize(1);
            assertThat(values[1].values[0])
                .isEqualTo(64);
            assertThat(values[1].tag)
                .isEqualTo("watches/apple");
            assertThat(values[1].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 5).getTime());
            assertThat(values[2].values)
                .hasSize(1);
            assertThat(values[2].values[0])
                .isEqualTo(65);
            assertThat(values[2].tag)
                .isEqualTo("watches/fitbit");
            assertThat(values[2].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 10).getTime());

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);
        }
    });

    it("includeTimeSeriesAndMergeWithExistingRangesInCache", async () => {
        const baseLine = testContext.utcToday();

        const documentId = "users/ayende";

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            await session.store(user, documentId);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const tsf = session.timeSeriesFor(documentId, "Heartrate");
            for (let i = 0; i < 360; i++) {
                tsf.append(addSeconds(baseLine, 10 * i), 6, "watches/fitbit");
            }

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            let vals = await session.timeSeriesFor(documentId, "Heartrate")
                .get(addMinutes(baseLine, 2), addMinutes(baseLine, 10));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            assertThat(vals)
                .hasSize(49);

            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 2).getTime());
            assertThat(vals[48].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 10).getTime());

            let user = await session.load<User>(documentId, {
                documentType: User,
                includes: i => i.includeTimeSeries("Heartrate",
                    addMinutes(baseLine, 40),
                    addMinutes(baseLine, 50))
            });

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(2);

            // should not go to server

            vals = await session.timeSeriesFor(documentId, "Heartrate")
                .get(addMinutes(baseLine, 40), addMinutes(baseLine, 50));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(2);

            assertThat(vals)
                .hasSize(61);

            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 40).getTime());
            assertThat(vals[60].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 50).getTime());

            const sessionOperations = session as unknown as InMemoryDocumentSessionOperations;

            const cache = sessionOperations.timeSeriesByDocId.get(documentId);

            assertThat(cache)
                .isNotNull();

            const ranges = cache.get("Heartrate");
            assertThat(ranges)
                .hasSize(2);

            assertThat(ranges[0].from.getTime())
                .isEqualTo(addMinutes(baseLine, 2).getTime());
            assertThat(ranges[0].to.getTime())
                .isEqualTo(addMinutes(baseLine, 10).getTime());
            assertThat(ranges[1].from.getTime())
                .isEqualTo(addMinutes(baseLine, 40).getTime());
            assertThat(ranges[1].to.getTime())
                .isEqualTo(addMinutes(baseLine, 50).getTime());

            // we intentionally evict just the document (without it's TS data),
            // so that Load request will go to server

            sessionOperations.documentsByEntity.evict(user);
            sessionOperations.documentsById.remove(documentId);

            // should go to server to get [0, 2] and merge it into existing [2, 10]

            user = await session.load<User>(documentId, {
                documentType: User,
                includes: i => i.includeTimeSeries(
                    "Heartrate", baseLine, addMinutes(baseLine, 2))
            });

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(3);

            // should not go to server

            vals = await session.timeSeriesFor(documentId, "Heartrate")
                .get(baseLine, addMinutes(baseLine, 2));


            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(3);

            assertThat(vals)
                .hasSize(13);
            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(baseLine.getTime());
            assertThat(vals[12].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 2).getTime());

            assertThat(ranges)
                .hasSize(2);
            assertThat(ranges[0].from.getTime())
                .isEqualTo(baseLine.getTime());
            assertThat(ranges[0].to.getTime())
                .isEqualTo(addMinutes(baseLine, 10).getTime());
            assertThat(ranges[1].from.getTime())
                .isEqualTo(addMinutes(baseLine, 40).getTime());
            assertThat(ranges[1].to.getTime())
                .isEqualTo(addMinutes(baseLine, 50).getTime());

            // evict just the document
            sessionOperations.documentsByEntity.evict(user);
            sessionOperations.documentsById.remove(documentId);

            // should go to server to get [10, 16] and merge it into existing [0, 10]
            user = await session.load<User>(documentId, {
                documentType: User,
                includes: i => i.includeTimeSeries(
                    "Heartrate",
                    addMinutes(baseLine, 10),
                    addMinutes(baseLine, 16))
            });

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(4);

            // should not go to server
            vals = await session.timeSeriesFor(documentId, "Heartrate")
                .get(addMinutes(baseLine, 10), addMinutes(baseLine, 16));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(4);

            assertThat(vals)
                .hasSize(37);
            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 10).getTime());
            assertThat(vals[36].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 16).getTime());

            assertThat(ranges)
                .hasSize(2);

            assertThat(ranges[0].from.getTime())
                .isEqualTo(addMinutes(baseLine, 0).getTime());
            assertThat(ranges[0].to.getTime())
                .isEqualTo(addMinutes(baseLine, 16).getTime());
            assertThat(ranges[1].from.getTime())
                .isEqualTo(addMinutes(baseLine, 40).getTime());
            assertThat(ranges[1].to.getTime())
                .isEqualTo(addMinutes(baseLine, 50).getTime());

            // evict just the document
            sessionOperations.documentsByEntity.evict(user);
            sessionOperations.documentsById.remove(documentId);

            // should go to server to get range [17, 19]
            // and add it to cache in between [10, 16] and [40, 50]

            user = await session.load<User>(documentId, {
                documentType: User,
                includes: i => i.includeTimeSeries(
                    "Heartrate",
                    addMinutes(baseLine, 17),
                    addMinutes(baseLine, 19))
            });

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(5);

            // should not go to server
            vals = await session.timeSeriesFor(documentId, "Heartrate")
                .get(addMinutes(baseLine, 17), addMinutes(baseLine, 19));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(5);

            assertThat(vals)
                .hasSize(13);
            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 17).getTime());
            assertThat(vals[12].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 19).getTime());

            assertThat(ranges)
                .hasSize(3);

            assertThat(ranges[0].from.getTime())
                .isEqualTo(addMinutes(baseLine, 0).getTime());
            assertThat(ranges[0].to.getTime())
                .isEqualTo(addMinutes(baseLine, 16).getTime());
            assertThat(ranges[1].from.getTime())
                .isEqualTo(addMinutes(baseLine, 17).getTime());
            assertThat(ranges[1].to.getTime())
                .isEqualTo(addMinutes(baseLine, 19).getTime());
            assertThat(ranges[2].from.getTime())
                .isEqualTo(addMinutes(baseLine, 40).getTime());
            assertThat(ranges[2].to.getTime())
                .isEqualTo(addMinutes(baseLine, 50).getTime());

            // evict just the document
            sessionOperations.documentsByEntity.evict(user);
            sessionOperations.documentsById.remove(documentId);

            // should go to server to get range [19, 40]
            // and merge the result with existing ranges [17, 19] and [40, 50]
            // into single range [17, 50]

            user = await session.load<User>(documentId, {
                documentType: User,
                includes: i => i.includeTimeSeries(
                    "Heartrate",
                    addMinutes(baseLine, 18),
                    addMinutes(baseLine, 48))
            });

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(6);

            // should not go to server
            vals = await session.timeSeriesFor(documentId, "Heartrate")
                .get(addMinutes(baseLine, 18), addMinutes(baseLine, 48));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(6);

            assertThat(vals)
                .hasSize(181);
            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 18).getTime());
            assertThat(vals[180].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 48).getTime());

            assertThat(ranges)
                .hasSize(2);

            assertThat(ranges[0].from.getTime())
                .isEqualTo(addMinutes(baseLine, 0).getTime());
            assertThat(ranges[0].to.getTime())
                .isEqualTo(addMinutes(baseLine, 16).getTime());
            assertThat(ranges[1].from.getTime())
                .isEqualTo(addMinutes(baseLine, 17).getTime());
            assertThat(ranges[1].to.getTime())
                .isEqualTo(addMinutes(baseLine, 50).getTime());

            // evict just the document
            sessionOperations.documentsByEntity.evict(user);
            sessionOperations.documentsById.remove(documentId);

            // should go to server to get range [12, 22]
            // and merge the result with existing ranges [0, 16] and [17, 50]
            // into single range [0, 50]

            user = await session.load<User>(documentId, {
                documentType: User,
                includes: i => i.includeTimeSeries(
                    "Heartrate",
                    addMinutes(baseLine, 12),
                    addMinutes(baseLine, 22))
            });

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(7);

            // should not go to server
            vals = await session.timeSeriesFor(documentId, "Heartrate")
                .get(addMinutes(baseLine, 12), addMinutes(baseLine, 22));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(7);

            assertThat(vals)
                .hasSize(61);
            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 12).getTime());
            assertThat(vals[60].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 22).getTime());

            assertThat(ranges)
                .hasSize(1);

            assertThat(ranges[0].from.getTime())
                .isEqualTo(addMinutes(baseLine, 0).getTime());
            assertThat(ranges[0].to.getTime())
                .isEqualTo(addMinutes(baseLine, 50).getTime());

            // evict just the document
            sessionOperations.documentsByEntity.evict(user);
            sessionOperations.documentsById.remove(documentId);

            // should go to server to get range [50, ∞]
            // and merge the result with existing range [0, 50] into single range [0, ∞]

            user = await session.load<User>(documentId, {
                documentType: User,
                includes: i => i.includeTimeSeries("heartrate", "Last", TimeValue.ofMinutes(10))
            });

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(8);

            // should not go to server
            vals = await session.timeSeriesFor(documentId, "heartrate")
                .get(addMinutes(baseLine, 50), null);

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(8);

            assertThat(vals)
                .hasSize(60);

            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 50).getTime());
            assertThat(vals[59].timestamp.getTime())
                .isEqualTo(addSeconds(addMinutes(baseLine, 59), 50).getTime());

            assertThat(ranges)
                .hasSize(1);
            assertThat(ranges[0].from.getTime())
                .isEqualTo(baseLine.getTime());
            assertThat(ranges[0].to)
                .isNull();
        }
    });

    it("includeTimeSeriesAndUpdateExistingRangeInCache", async () => {
        const baseLine = testContext.utcToday();

        const documentId = "users/ayende";

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            await session.store(user, documentId);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const tsf = session.timeSeriesFor(documentId, "Heartrate");
            for (let i = 0; i < 360; i++) {
                tsf.append(addSeconds(baseLine, 10 * i), 6, "watches/fitbit");
            }

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            let vals = await session.timeSeriesFor("users/ayende", "Heartrate")
                .get(addMinutes(baseLine, 2), addMinutes(baseLine, 10));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            assertThat(vals)
                .hasSize(49);
            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 2).getTime());
            assertThat(vals[48].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 10).getTime());

            session.timeSeriesFor("users/ayende", "Heartrate")
                .append(addMinutes(addSeconds(baseLine, 3), 3), 6, "watches/fitbit");

            await session.saveChanges();

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(2);

            const user = await session.load<User>("users/ayende", {
                documentType: User,
                includes: i => i.includeTimeSeries(
                    "Heartrate",
                    addMinutes(baseLine, 3),
                    addMinutes(baseLine, 5))
            });

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(3);

            // should not go to server

            vals = await session.timeSeriesFor("users/ayende", "Heartrate")
                .get(addMinutes(baseLine, 3), addMinutes(baseLine, 5));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(3);

            assertThat(vals)
                .hasSize(14);

            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 3).getTime());
            assertThat(vals[1].timestamp.getTime())
                .isEqualTo(addSeconds(addMinutes(baseLine, 3), 3).getTime());
            assertThat(vals[13].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 5).getTime());
        }
    });

    it("includeMultipleTimeSeries", async () => {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            await session.store(user, "users/ayende");
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            for (let i = 0; i < 360; i++) {
                session.timeSeriesFor("users/ayende", "Heartrate")
                    .append(addSeconds(baseLine, i * 10), 6, "watches/fitbit");
                session.timeSeriesFor("users/ayende", "BloodPressure")
                    .append(addSeconds(baseLine, i * 10), 66, "watches/fitbit");
                session.timeSeriesFor("users/ayende", "Nasdaq")
                    .append(addSeconds(baseLine, i * 10), 8097.23, "nasdaq.com");
            }

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const user = await session.load<User>("users/ayende", {
                documentType: User,
                includes: i => i
                    .includeTimeSeries(
                        "Heartrate",
                        addMinutes(baseLine, 3),
                        addMinutes(baseLine, 5))
                    .includeTimeSeries(
                        "BloodPressure",
                        addMinutes(baseLine, 40),
                        addMinutes(baseLine, 45))
                    .includeTimeSeries(
                        "Nasdaq",
                        addMinutes(baseLine, 15),
                        addMinutes(baseLine, 25))
            });

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            assertThat(user.name)
                .isEqualTo("Oren");

            // should not go to server

            let vals = await session.timeSeriesFor("users/ayende", "Heartrate")
                .get(addMinutes(baseLine, 3), addMinutes(baseLine, 5));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);
            assertThat(vals)
                .hasSize(13);

            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 3).getTime());
            assertThat(vals[12].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 5).getTime());

            // should not go to server

            vals = await session.timeSeriesFor("users/ayende", "BloodPressure")
                .get(addMinutes(baseLine, 42), addMinutes(baseLine, 43));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);
            assertThat(vals)
                .hasSize(7);

            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 42).getTime());
            assertThat(vals[6].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 43).getTime());

            // should not go to server

            vals = await session.timeSeriesFor("users/ayende", "BloodPressure")
                .get(addMinutes(baseLine, 40), addMinutes(baseLine, 45));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);
            assertThat(vals)
                .hasSize(31);

            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 40).getTime());
            assertThat(vals[30].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 45).getTime());

            // should not go to server

            vals = await session.timeSeriesFor("users/ayende", "Nasdaq")
                .get(addMinutes(baseLine, 15), addMinutes(baseLine, 25));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);
            assertThat(vals)
                .hasSize(61);

            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 15).getTime());
            assertThat(vals[60].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 25).getTime());
        }
    });

    it("shouldCacheEmptyTimeSeriesRanges", async () => {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            await session.store(user, "users/ayende");
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            for (let i = 0; i < 360; i++) {
                session.timeSeriesFor("users/ayende", "Heartrate")
                    .append(addSeconds(baseLine, i * 10), 6, "watches/fitbit");
            }

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            let user = await session.load<User>("users/ayende", {
                documentType: User,
                includes: i => i
                    .includeTimeSeries(
                        "Heartrate",
                        addMinutes(baseLine, -30),
                        addMinutes(baseLine, -10))
            });

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            assertThat(user.name)
                .isEqualTo("Oren");

            // should not go to server

            let vals = await session.timeSeriesFor("users/ayende", "Heartrate")
                .get(addMinutes(baseLine, -30), addMinutes(baseLine, -10));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);
            assertThat(vals)
                .hasSize(0);

            let sessionOperations = session as unknown as InMemoryDocumentSessionOperations;
            let cache = sessionOperations.timeSeriesByDocId.get("users/ayende");
            let ranges = cache.get("Heartrate");

            assertThat(ranges)
                .hasSize(1);

            assertThat(ranges[0].entries)
                .hasSize(0);
            assertThat(ranges[0].from.getTime())
                .isEqualTo(addMinutes(baseLine, -30).getTime());
            assertThat(ranges[0].to.getTime())
                .isEqualTo(addMinutes(baseLine, -10).getTime());

            // should not go to server
            vals = await session.timeSeriesFor("users/ayende", "Heartrate")
                .get(addMinutes(baseLine, -25), addMinutes(baseLine, -15));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);
            assertThat(vals)
                .hasSize(0);

            session.advanced.evict(user);

            user = await session.load<User>("users/ayende", {
                documentType: User,
                includes: i => i
                    .includeTimeSeries(
                        "BloodPressure",
                        addMinutes(baseLine, 10),
                        addMinutes(baseLine, 30))
            });

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(2);

            // should not go to server

            vals = await session.timeSeriesFor("users/ayende", "BloodPressure")
                .get(addMinutes(baseLine, 10), addMinutes(baseLine, 30));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(2);

            assertThat(vals)
                .hasSize(0);

            sessionOperations = session as unknown as InMemoryDocumentSessionOperations;

            cache = sessionOperations.timeSeriesByDocId.get("users/ayende");
            ranges = cache.get("BloodPRessure");

            assertThat(ranges)
                .hasSize(1);
            assertThat(ranges[0].entries)
                .hasSize(0);

            assertThat(ranges[0].from.getTime())
                .isEqualTo(addMinutes(baseLine, 10).getTime());
            assertThat(ranges[0].to.getTime())
                .isEqualTo(addMinutes(baseLine, 30).getTime());
        }
    });

    it("multiLoadWithIncludeTimeSeries", async () => {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            const user1 = new User();
            user1.name = "Oren";
            await session.store(user1, "users/ayende");

            const user2 = new User();
            user2.name = "Pawel";
            await session.store(user2, "users/ppekrol");

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const tsf1 = session.timeSeriesFor("users/ayende", "Heartrate");
            const tsf2 = session.timeSeriesFor("users/ppekrol", "Heartrate");

            for (let i = 0; i < 360; i++) {
                tsf1.append(addSeconds(baseLine, i * 10), 6, "watches/fitbit");

                if (i % 2 === 0) {
                    tsf2.append(addSeconds(baseLine, i * 10), 7, "watches/fitbit");
                }
            }

            await session.saveChanges();
        }

        {
            const session = store.openSession();

            const users = await session.load<User>(["users/ayende", "users/ppekrol"], {
                includes: i => i.includeTimeSeries("Heartrate", baseLine, addMinutes(baseLine, 30))
            });

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            assertThat(users["users/ayende"].name)
                .isEqualTo("Oren");
            assertThat(users["users/ppekrol"].name)
                .isEqualTo("Pawel");

            // should not go to server

            let vals = await session.timeSeriesFor("users/ayende", "Heartrate")
                .get(baseLine, addMinutes(baseLine, 30));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            assertThat(vals)
                .hasSize(181);

            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(baseLine.getTime());
            assertThat(vals[180].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 30).getTime());

            // should not go to server

            vals = await session.timeSeriesFor("users/ppekrol", "Heartrate")
                .get(baseLine, addMinutes(baseLine, 30));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            assertThat(vals)
                .hasSize(91);
            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(baseLine.getTime());
            assertThat(vals[90].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 30).getTime());
        }
    });

    it("includeTimeSeriesAndDocumentsAndCounters", async () => {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            user.worksAt = "companies/1";
            await session.store(user, "users/ayende");

            const company = new Company();
            company.name = "HR";
            await session.store(company, "companies/1");

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const tsf = session.timeSeriesFor("users/ayende", "Heartrate");

            for (let i = 0; i < 360; i++) {
                tsf.append(addSeconds(baseLine, i * 10), 67, "watches/fitbit");
            }

            session.countersFor("users/ayende").increment("likes", 100);
            session.countersFor("users/ayende").increment("dislikes", 5);

            await session.saveChanges();
        }

        {
            const session = store.openSession();

            const user = await session.load<User>("users/ayende", {
                documentType: User,
                includes: i => i
                    .includeDocuments("worksAt")
                    .includeTimeSeries("Heartrate", baseLine, addMinutes(baseLine, 30))
                    .includeCounter("likes")
                    .includeCounter("dislikes")
            });

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            assertThat(user.name)
                .isEqualTo("Oren");

            // should not go to server

            const company = await session.load<Company>(user.worksAt, Company);
            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            assertThat(company.name)
                .isEqualTo("HR");

            // should not go to server
            const vals = await session.timeSeriesFor("users/ayende", "Heartrate")
                .get(baseLine, addMinutes(baseLine, 30));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            assertThat(vals)
                .hasSize(181);

            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(baseLine.getTime());
            assertThat(vals[0].tag)
                .isEqualTo("watches/fitbit");
            assertThat(vals[0].values[0])
                .isEqualTo(67);
            assertThat(vals[180].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 30).getTime());

            // should not go to server

            const counters = await session.countersFor("users/ayende")
                .getAll();

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            let counter = counters["likes"];
            assertThat(counter)
                .isEqualTo(100);

            counter = counters["dislikes"];
            assertThat(counter)
                .isEqualTo(5);
        }
    });

    it("queryWithIncludeTimeSeries", async () => {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            await session.store(user, "users/ayende");
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const tsf = session.timeSeriesFor("users/ayende", "Heartrate");

            for (let i = 0; i < 360; i++) {
                tsf.append(addSeconds(baseLine, i * 10), 67, "watches/fitbit");
            }

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const query = session.query(User)
                .include(i => i.includeTimeSeries("Heartrate"));

            const result = await query.all();

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            assertThat(result[0].name)
                .isEqualTo("Oren");

            // should not go to server

            const vals = await session.timeSeriesFor("users/ayende", "Heartrate")
                .get(baseLine, addMinutes(baseLine, 30));

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            assertThat(vals)
                .hasSize(181);
            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(baseLine.getTime());
            assertThat(vals[0].tag)
                .isEqualTo("watches/fitbit");
            assertThat(vals[0].values[0])
                .isEqualTo(67);
            assertThat(vals[180].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 30).getTime());
        }
    });

    it("canLoadAsyncWithIncludeTimeSeries_LastRange_ByCount", async function () {
        const baseLine = addHours(testContext.utcToday(), 12);

        {
            const session = store.openSession();
            const company = new Company();
            company.name = "HR";
            await session.store(company, "companies/1-A");

            const order = new Order();
            order.company = "companies/1-A";
            await session.store(order, "orders/1-A");

            const tsf = session.timeSeriesFor("orders/1-A", "heartrate");

            for (let i = 0; i < 15; i++) {
                tsf.append(addMinutes(baseLine, -i), i, "watches/fitbit");
            }

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const order = await session.load("orders/1-A", {
                documentType: Order,
                includes: i => i.includeDocuments("company")
                    .includeTimeSeries("heartrate", "Last", 11)
            });

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            // should not go to server

            const company = await session.load(order.company, Company);

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);
            assertThat(company.name)
                .isEqualTo("HR");

            // should not go to server
            const values = await session.timeSeriesFor(order, "heartrate")
                .get(addMinutes(baseLine, -10), null);

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);
            assertThat(values)
                .hasSize(11);

            for (let i = 0; i < values.length; i++) {
                assertThat(values[i].values)
                    .hasSize(1);
                assertThat(values[i].values[0])
                    .isEqualTo(values.length - 1 - i);
                assertThat(values[i].tag)
                    .isEqualTo("watches/fitbit");
                assertThat(values[i].timestamp.getTime())
                    .isEqualTo(addMinutes(baseLine, -(values.length - 1 - i)).getTime());

            }
        }
    });

    it("canLoadAsyncWithInclude_AllTimeSeries_LastRange_ByTime", async function () {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            const company = new Company();
            company.name = "HR";
            await session.store(company, "companies/1-A");

            const order = new Order();
            order.company = "companies/1-A";
            await session.store(order, "orders/1-A");

            const tsf = session.timeSeriesFor("orders/1-A", "heartrate");

            for (let i = 0; i < 15; i++) {
                tsf.append(addMinutes(baseLine, -i), i, "watches/bitfit");
            }

            const tsf2 = session.timeSeriesFor("orders/1-A", "speedrate");
            for (let i = 0; i < 15; i++) {
                tsf2.append(addMinutes(baseLine, -i), i, "watches/fitbit");
            }
            
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const order = await session.load<Order>("orders/1-A", {
                documentType: Order,
                includes: i => i.includeDocuments("company").includeAllTimeSeries("Last", TimeValue.ofMinutes(10))
            });

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            // should not go to server
            const company = await session.load(order.company, Company);
            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            assertThat(company.name)
                .isEqualTo("HR");

            // should not go to server
            const heartrateValues = await session.timeSeriesFor(order, "heartrate")
                .get(addMinutes(baseLine, -10), null);

            assertThat(heartrateValues)
                .hasSize(11);

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            const speedrateValues = await session.timeSeriesFor(order, "speedrate")
                .get(addMinutes(baseLine, -10), null);

            assertThat(speedrateValues)
                .hasSize(11);
            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            for (let i = 0; i < heartrateValues.length; i++) {
                assertThat(heartrateValues[i].values)
                    .hasSize(1);
                assertThat(heartrateValues[i].values[0])
                    .isEqualTo(heartrateValues.length - 1 - i);
                assertThat(heartrateValues[i].tag)
                    .isEqualTo("watches/bitfit");
                assertThat(heartrateValues[i].timestamp.getTime())
                    .isEqualTo(addMinutes(baseLine, -(heartrateValues.length - 1 - i)).getTime());
            }

            for (let i = 0; i < speedrateValues.length; i++) {
                assertThat(speedrateValues[i].values)
                    .hasSize(1);
                assertThat(speedrateValues[i].values[0])
                    .isEqualTo(speedrateValues.length - 1 - i);
                assertThat(speedrateValues[i].tag)
                    .isEqualTo("watches/fitbit");
                assertThat(speedrateValues[i].timestamp.getTime())
                    .isEqualTo(addMinutes(baseLine, -(speedrateValues.length - 1 - i)).getTime());
            }
        }
    });

    it("canLoadAsyncWithInclude_AllTimeSeries_LastRange_ByCount", async function () {
        const baseLine = addHours(testContext.utcToday(), 3);

        {
            const session = store.openSession();
            const company = new Company();
            company.name = "HR";
            await session.store(company, "companies/1-A");

            const order = new Order();
            order.company = "companies/1-A";
            await session.store(order, "orders/1-A");

            const tsf = session.timeSeriesFor("orders/1-A", "heartrate");
            for (let i = 0; i < 15; i++) {
                tsf.append(addMinutes(baseLine, -i), i, "watches/bitfit");
            }

            const tsf2 = session.timeSeriesFor("orders/1-A", "speedrate");
            for (let i = 0; i < 15; i++) {
                tsf2.append(addMinutes(baseLine, -i), i, "watches/fitbit");
            }

            await session.saveChanges();
        }

        {
            const session = store.openSession();

            const order = await session.load<Order>("orders/1-A", {
                documentType: Order,
                includes: i => i.includeDocuments("company").includeAllTimeSeries("Last", 11)
            });

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            // should not go to server
            const company = await session.load(order.company, Company);
            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            assertThat(company.name)
                .isEqualTo("HR");

            // should not go to server
            const heartrateValues = await session.timeSeriesFor(order, "heartrate")
                .get(addMinutes(baseLine, -10), null);

            assertThat(heartrateValues)
                .hasSize(11);
            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            const speedrateValues = await session.timeSeriesFor(order, "speedrate")
                .get(addMinutes(baseLine, -10), null);

            assertThat(speedrateValues)
                .hasSize(11);
            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            for (let i = 0; i < heartrateValues.length; i++) {
                assertThat(heartrateValues[i].values)
                    .hasSize(1);
                assertThat(heartrateValues[i].values[0])
                    .isEqualTo(heartrateValues.length - 1 - i);
                assertThat(heartrateValues[i].tag)
                    .isEqualTo("watches/bitfit");
                assertThat(heartrateValues[i].timestamp.getTime())
                    .isEqualTo(addMinutes(baseLine, -(heartrateValues.length - 1 - i)).getTime());
            }

            for (let i = 0; i < speedrateValues.length; i++) {
                assertThat(speedrateValues[i].values)
                    .hasSize(1);
                assertThat(speedrateValues[i].values[0])
                    .isEqualTo(speedrateValues.length - 1 - i);
                assertThat(speedrateValues[i].tag)
                    .isEqualTo("watches/fitbit");
                assertThat(speedrateValues[i].timestamp.getTime())
                    .isEqualTo(addMinutes(baseLine, -(speedrateValues.length - 1 - i)).getTime());
            }
        }
    });

    it("shouldThrowOnIncludeAllTimeSeriesAfterIncludingTimeSeries", async function () {
        {
            const session = store.openSession();
            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("Last", 11)
                        .includeAllTimeSeries("Last", TimeValue.ofMinutes(10))
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("IIncludeBuilder: Cannot use 'includeAllTimeSeries' after using 'includeTimeSeries' or 'includeAllTimeSeries'.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("Last", Number.MAX_SAFE_INTEGER)
                        .includeAllTimeSeries("Last", 11)
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("IIncludeBuilder: Cannot use 'includeAllTimeSeries' after using 'includeTimeSeries' or 'includeAllTimeSeries'.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeTimeSeries("heartrate", "Last", Number.MAX_SAFE_INTEGER)
                        .includeAllTimeSeries("Last", TimeValue.ofMinutes(10))
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("IIncludeBuilder: Cannot use 'includeAllTimeSeries' after using 'includeTimeSeries' or 'includeAllTimeSeries'.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeTimeSeries("heartrate", "Last", Number.MAX_SAFE_INTEGER)
                        .includeAllTimeSeries("Last", 11)
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("IIncludeBuilder: Cannot use 'includeAllTimeSeries' after using 'includeTimeSeries' or 'includeAllTimeSeries'.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeTimeSeries("heartrate", "Last", 1)
                        .includeAllTimeSeries("Last", TimeValue.ofMinutes(10))
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("IIncludeBuilder: Cannot use 'includeAllTimeSeries' after using 'includeTimeSeries' or 'includeAllTimeSeries'.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeTimeSeries("heartrate", "Last", 11)
                        .includeAllTimeSeries("Last", 11)
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("IIncludeBuilder: Cannot use 'includeAllTimeSeries' after using 'includeTimeSeries' or 'includeAllTimeSeries'.");
            });
        }
    });

    it("shouldThrowOnIncludingTimeSeriesAfterIncludeAllTimeSeries", async function() {
        {
            const session = store.openSession();

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("Last", 11)
                        .includeAllTimeSeries("Last", TimeValue.ofMinutes(10))
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("IIncludeBuilder: Cannot use 'includeAllTimeSeries' after using 'includeTimeSeries' or 'includeAllTimeSeries'.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("Last", Number.MAX_SAFE_INTEGER)
                        .includeAllTimeSeries("Last", 11)
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("IIncludeBuilder: Cannot use 'includeAllTimeSeries' after using 'includeTimeSeries' or 'includeAllTimeSeries'.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("Last", TimeValue.ofMinutes(10))
                        .includeTimeSeries("heartrate", "Last", Number.MAX_SAFE_INTEGER)
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("IIncludeBuilder: Cannot use 'includeTimeSeries' or 'includeAllTimeSeries' after using 'includeAllTimeSeries'.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("Last", 11)
                        .includeTimeSeries("heartrate", "Last", Number.MAX_SAFE_INTEGER)
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("IIncludeBuilder: Cannot use 'includeTimeSeries' or 'includeAllTimeSeries' after using 'includeAllTimeSeries'.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("Last", TimeValue.ofMinutes(10))
                        .includeTimeSeries("heartrate", "Last", 11)
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("IIncludeBuilder: Cannot use 'includeTimeSeries' or 'includeAllTimeSeries' after using 'includeAllTimeSeries'.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("Last", 11)
                        .includeTimeSeries("heartrate", "Last", 11)
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("IIncludeBuilder: Cannot use 'includeTimeSeries' or 'includeAllTimeSeries' after using 'includeAllTimeSeries'.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("Last", 11)
                        .includeAllTimeSeries("Last", TimeValue.ofMinutes(10))
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("IIncludeBuilder: Cannot use 'includeAllTimeSeries' after using 'includeTimeSeries' or 'includeAllTimeSeries'.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("Last", TimeValue.ofMinutes(10))
                        .includeTimeSeries("heartrate", "Last", Number.MAX_SAFE_INTEGER)
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("IIncludeBuilder: Cannot use 'includeTimeSeries' or 'includeAllTimeSeries' after using 'includeAllTimeSeries'.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("Last", 11)
                        .includeTimeSeries("heartrate", "Last", TimeValue.MAX_VALUE)
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("IIncludeBuilder: Cannot use 'includeTimeSeries' or 'includeAllTimeSeries' after using 'includeAllTimeSeries'.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("Last", TimeValue.ofMinutes(10))
                        .includeTimeSeries("heartrate", "Last", 11)
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("IIncludeBuilder: Cannot use 'includeTimeSeries' or 'includeAllTimeSeries' after using 'includeAllTimeSeries'.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("Last", 11)
                        .includeTimeSeries("heartrate", "Last", 11)
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("IIncludeBuilder: Cannot use 'includeTimeSeries' or 'includeAllTimeSeries' after using 'includeAllTimeSeries'.");
            });


            assertThat(session.advanced.numberOfRequests)
                .isZero();
        }
    });

    it("shouldThrowOnIncludingTimeSeriesWithLastRangeZeroOrNegativeTime", async function () {
        {
            const session = store.openSession();
            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("Last", TimeValue.MIN_VALUE)
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("Time range type cannot be set to 'Last' when time is negative or zero.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("Last", TimeValue.ZERO)
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("Time range type cannot be set to 'Last' when time is negative or zero.");
            });

            assertThat(session.advanced.numberOfRequests)
                .isZero();
        }
    });

    it("shouldThrowOnIncludingTimeSeriesWithNoneRange", async function () {
        {
            const session = store.openSession();

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("None", TimeValue.ofMinutes(-30))
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("Time range type cannot be set to 'None' when time is specified.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("None", TimeValue.ZERO)
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("Time range type cannot be set to 'None' when time is specified.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("None", 1024)
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("Time range type cannot be set to 'None' when count is specified.");
            });

            await assertThrows(async () => {
                await session.load<Order>("orders/1-A", {
                    documentType: Order,
                    includes: i => i
                        .includeDocuments("company")
                        .includeAllTimeSeries("None", TimeValue.ofMinutes(30))
                })
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .startsWith("Time range type cannot be set to 'None' when time is specified.");
            });

            assertThat(session.advanced.numberOfRequests)
                .isZero();
        }
    });

    it("shouldThrowOnIncludingTimeSeriesWithNegativeCount", async function () {
        const session = store.openSession();

        await assertThrows(async () => {
            await session.load<Order>("orders/1-A", {
                documentType: Order,
                includes: i => i
                    .includeDocuments("company")
                    .includeAllTimeSeries("Last", -1024)
            })
        }, err => {
            assertThat(err.name)
                .isEqualTo("InvalidArgumentException");
            assertThat(err.message)
                .startsWith("Count have to be positive.");
        });
    });

    it("canLoadAsyncWithInclude_ArrayOfTimeSeriesLastRangeByTime", () => canLoadAsyncWithInclude_ArrayOfTimeSeriesLastRange(store, true));

    it("canLoadAsyncWithInclude_ArrayOfTimeSeriesLastRangeByCount", () => canLoadAsyncWithInclude_ArrayOfTimeSeriesLastRange(store, false));
});

async function canLoadAsyncWithInclude_ArrayOfTimeSeriesLastRange(store: IDocumentStore, byTime: boolean) {

    const baseLine = byTime ? new Date() : testContext.utcToday();

    {
        const session = store.openSession();
        const company = new Company();
        company.name = "HR";
        await session.store(company, "companies/1-A");

        const order = new Order();
        order.company = "companies/1-A";
        await session.store(order, "orders/1-A");

        const tsf = session.timeSeriesFor("orders/1-A", "heartrate");
        tsf.append(baseLine, 67, "watches/apple");
        tsf.append(addMinutes(baseLine, -5), 64, "watches/apple");
        tsf.append(addMinutes(baseLine, -10), 65, "watches/fitbit");

        const tsf2 = session.timeSeriesFor("orders/1-A", "speedrate");
        tsf2.append(addMinutes(baseLine, -15), 6, "watches/bitfit");
        tsf2.append(addMinutes(baseLine, -10), 7, "watches/bitfit");
        tsf2.append(addMinutes(baseLine, -9), 7, "watches/bitfit");
        tsf2.append(addMinutes(baseLine, -8), 6, "watches/bitfit");

        await session.saveChanges();
    }

    {
        const session = store.openSession();
        let order: Order;

        if (byTime) {
            order = await session.load<Order>("orders/1-A", {
                documentType: Order,
                includes: i => i
                    .includeDocuments("company")
                    .includeTimeSeries(["heartrate", "speedrate"], "Last", TimeValue.ofMinutes(10))
            });
        } else {
            order = await session.load<Order>("orders/1-A", {
                documentType: Order,
                includes: i => i
                    .includeDocuments("company")
                    .includeTimeSeries(["heartrate", "speedrate"], "Last", 3)
            });
        }

        assertThat(session.advanced.numberOfRequests)
            .isEqualTo(1);

        // should not go to server
        const company = await session.load(order.company, Company);

        assertThat(session.advanced.numberOfRequests)
            .isEqualTo(1);
        assertThat(company.name)
            .isEqualTo("HR");

        // should not go to server
        const heartrateValues = await session.timeSeriesFor(order, "heartrate")
            .get(addMinutes(baseLine, -10), null);

        assertThat(session.advanced.numberOfRequests)
            .isEqualTo(1);
        assertThat(heartrateValues)
            .hasSize(3);

        assertThat(heartrateValues[0].values)
            .hasSize(1);
        assertThat(heartrateValues[0].values[0])
            .isEqualTo(65);
        assertThat(heartrateValues[0].tag)
            .isEqualTo("watches/fitbit");
        assertThat(heartrateValues[0].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, -10).getTime());

        assertThat(heartrateValues[1].values)
            .hasSize(1);
        assertThat(heartrateValues[1].values[0])
            .isEqualTo(64);
        assertThat(heartrateValues[1].tag)
            .isEqualTo("watches/apple");
        assertThat(heartrateValues[1].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, -5).getTime());

        assertThat(heartrateValues[2].values)
            .hasSize(1);
        assertThat(heartrateValues[2].values[0])
            .isEqualTo(67);
        assertThat(heartrateValues[2].tag)
            .isEqualTo("watches/apple");
        assertThat(heartrateValues[2].timestamp.getTime())
            .isEqualTo(baseLine.getTime());

        // should not go to server
        const speedrateValues = await session.timeSeriesFor(order, "speedrate")
            .get(addMinutes(baseLine, -10), null);

        assertThat(session.advanced.numberOfRequests)
            .isEqualTo(1);
        assertThat(speedrateValues)
            .hasSize(3);

        assertThat(speedrateValues[0].values)
            .hasSize(1);
        assertThat(speedrateValues[0].values[0])
            .isEqualTo(7);
        assertThat(speedrateValues[0].tag)
            .isEqualTo("watches/bitfit");
        assertThat(speedrateValues[0].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, -10).getTime());

        assertThat(speedrateValues[1].values)
            .hasSize(1);
        assertThat(speedrateValues[1].values[0])
            .isEqualTo(7);
        assertThat(speedrateValues[1].tag)
            .isEqualTo("watches/bitfit");
        assertThat(speedrateValues[1].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, -9).getTime());

        assertThat(speedrateValues[2].values)
            .hasSize(1);
        assertThat(speedrateValues[2].values[0])
            .isEqualTo(6);
        assertThat(speedrateValues[2].tag)
            .isEqualTo("watches/bitfit");
        assertThat(speedrateValues[2].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, -8).getTime());
    }

    it("sessionLoadWithIncludeTimeSeries2", async () => {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            const order = new Order();
            order.company = "companies/apple";
            await session.store(order, "orders/1-A");

            const company = new Company();
            company.name = "apple";
            await session.store(company, "companies/apple");

            const tsf = session.timeSeriesFor("orders/1-A", "Heartrate");
            tsf.append(baseLine, 67, "companies/apple");
            tsf.append(addMinutes(baseLine, 5), 64, "companies/apple");
            tsf.append(addMinutes(baseLine, 10), 65, "companies/google");

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const company = new Company();
            company.name = "google";
            await session.store(company, "companies/google");

            const res = await session.timeSeriesFor("orders/1-A", "Heartrate").get(null, null, i => i.includeDocument().includeTags());
            assertThat(res)
                .hasSize(3);

            // should not go to server
            const apple = await session.load("companies/apple", Company);
            const google = await session.load("companies/google", Company);
            assertThat(apple)
                .isNotNull();
            assertThat(google)
                .isNotNull();

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);
        }
    });

    it("sessionLoadWithIncludeTimeSeriesRanges", async function () {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();

            const order = new Order();
            order.company = "companies/apple";
            await session.store(order, "orders/1-A");

            const company1 = new Company();
            company1.name = "apple";
            await session.store(company1, "companies/apple");

            const company2 = new Company();
            company2.name = "facebook";
            await session.store(company2, "companies/facebook");

            const company3 = new Company();
            company3.name = "amazon";
            await session.store(company3, "companies/amazon");

            const company4 = new Company();
            company4.name = "google";
            await session.store(company4, "companies/google");

            const tsf = session.timeSeriesFor("orders/1-A", "Heartrate");
            tsf.append(baseLine, 67, "companies/apple");
            tsf.append(addMinutes(baseLine, 5), 64, "companies/apple");
            tsf.append(addMinutes(baseLine, 10), 65, "companies/google");

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            //get 3 points so they'll get saved in session
            const nowDate = baseLine;
            const nowPlus5 = addMinutes(baseLine, 5);
            const nowPlus10 = addMinutes(baseLine, 10);
            await session.timeSeriesFor("orders/1-A", "Heartrate").get(nowDate, nowDate);
            await session.timeSeriesFor("orders/1-A", "Heartrate").get(nowPlus5, nowPlus5);
            await session.timeSeriesFor("orders/1-A", "Heartrate").get(nowPlus10, nowPlus10);

            //ask for the entire range - will call MultipleTimeSeriesRanges operation
            await session.timeSeriesFor("orders/1-A", "Heartrate").get(nowDate, nowPlus10, i => i.includeDocument().includeTags());

            const inMemoryDocumentSession = session as unknown as InMemoryDocumentSessionOperations;
            assertThat(inMemoryDocumentSession.includedDocumentsById)
                .containsKey("orders/1-A")
                .containsKey("companies/apple")
                .containsKey("companies/google");
        }
    });

    it("timeSeriesIncludeTagsCaseSensitive", async function() {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();

            const order = new Order();
            order.company = "companies/google";
            await session.store(order, "orders/1-A");

            const company1 = new Company();
            company1.name = "google";
            await session.store(company1, "companies/google");

            const company2 = new Company();
            company2.name = "amazon";
            await session.store(company2, "companies/amazon");

            const company3 = new Company();
            company3.name = "apple";
            await session.store(company3, "companies/apple");

            const tsf = session.timeSeriesFor("orders/1-A", "Heartrate");
            tsf.append(baseLine, 67, "companies/apple");
            tsf.append(addMinutes(baseLine, 5), 68, "companies/apple");
            tsf.append(addMinutes(baseLine, 10), 69, "companies/amazon");

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const reqRanges: TimeSeriesRange[] = [{
                from: null,
                to: null,
                name: "Heartrate"
            }];

            const result = await session.timeSeriesFor("orders/1-A", "Heartrate")
                .get(null, null, i => i.includeTags());
            const resultMultiGet = await store.operations.send(new GetMultipleTimeSeriesOperation("orders/1-A", reqRanges, 0, 1000, i => i.includeTags()));

            assertThat(resultMultiGet.values["Heartrate"])
                .isNotNull();

            const inMemoryDocumentSession = session as unknown as InMemoryDocumentSessionOperations;
            assertThat(inMemoryDocumentSession.includedDocumentsById)
                .containsKey("companies/google")
                .containsKey("companies/apple")
                .containsKey("companies/amazon");

            assertThat(resultMultiGet.values["Heartrate"])
                .hasSize(1);
        }
    });
}

class User {
    public name: string;
    public worksAt: string;
    public id: string;
}