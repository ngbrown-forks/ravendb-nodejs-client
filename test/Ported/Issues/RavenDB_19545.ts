import { IDocumentStore } from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { User } from "../../Assets/Entities.js";
import { assertThat } from "../../Utils/AssertExtensions.js";
import { addDays, addHours, addMilliseconds, addSeconds } from "date-fns";

describe("RavenDB_19545Test", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("removingTimeSeriesEntryShouldAffectCache", async () => {
        const docId = "user/1";
        const timeSeriesName = "HeartRates";
        const tag = "watches/fitbit";

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Lev";
            await session.store(user, docId);

            const tsf = session.timeSeriesFor(docId, timeSeriesName);
            tsf.append(addHours(testContext.utcToday(), 23), 67, tag);
            await session.saveChanges();

            const entries = await session.timeSeriesFor(docId, timeSeriesName).get();
            assertThat(entries)
                .hasSize(1);

            session.timeSeriesFor(docId, timeSeriesName).delete(null, null);
            await session.saveChanges();

            const entries2 = await session.timeSeriesFor(docId, timeSeriesName).get();
            assertThat(entries2)
                .isNull();
        }
    });

    it("removingTimeSeriesEntryShouldAffectCache2", async function() {
        const docId = "user/1";
        const timeSeriesName = "HeartRates";
        const tag = "watches/fitbit";
        const baseline = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Lev";
            await session.store(user, docId);

            const tsf = session.timeSeriesFor(docId, timeSeriesName);
            for (let i = 1; i <= 10; i++) {
                tsf.append(addDays(baseline, i), i, tag);
                await session.saveChanges();
            }

            // in java we add one millisecond as we always operate on ms precision
            let entries = await session.timeSeriesFor(docId, timeSeriesName)
                .get(
                    addDays(addMilliseconds(baseline, 1), 9),
                    addDays(baseline, 11)
                );
            assertThat(entries)
                .hasSize(1);

            // in java we add one millisecond as we always operate on ms precision
            entries = await session.timeSeriesFor(docId, timeSeriesName)
                .get(
                    addDays(addMilliseconds(baseline, 1), 3),
                    addDays(baseline, 8)
                );
            assertThat(entries)
                .hasSize(5);

            session.timeSeriesFor(docId, timeSeriesName)
                .delete(addDays(baseline, 4), addDays(baseline, 7));
            await session.saveChanges();

            const entries2 = await session.timeSeriesFor(docId, timeSeriesName).get();
            assertThat(entries2)
                .hasSize(6);
        }
    });

    it("removingTimeSeriesEntryShouldAffectCache3", async function() {
        const docId = "user/1";
        const timeSeriesName = "HeartRates";
        const tag = "watches/fitbit";

        const baseline = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Lev";
            await session.store(user, docId);

            const tsf = session.timeSeriesFor(docId, timeSeriesName);
            for (let i = 1; i <= 10; i++) {
                tsf.append(addDays(baseline, i), i, tag);
                await session.saveChanges();
            }

            let entries = await session.timeSeriesFor(docId, timeSeriesName)
                .get(addSeconds(addDays(baseline, 9), 1), addDays(baseline, 11));
            assertThat(entries)
                .hasSize(1);

            entries = await session.timeSeriesFor(docId, timeSeriesName)
                .get(null, addDays(baseline, 8));
            assertThat(entries)
                .hasSize(8);

            session.timeSeriesFor(docId, timeSeriesName)
                .delete(null, addDays(baseline, 7));
            await session.saveChanges();

            const entries2 = await session.timeSeriesFor(docId, timeSeriesName).get();
            assertThat(entries2)
                .hasSize(3);
        }
    });

    it("removingTimeSeriesEntryShouldAffectCache4", async function () {
        const docId = "user/1";
        const timeSeriesName = "HeartRates";
        const tag = "watches/fitbit";

        const baseline = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Lev";
            await session.store(user, docId);

            const tsf = session.timeSeriesFor(docId, timeSeriesName);
            for (let i = 1; i <= 10; i++) {
                tsf.append(addDays(baseline, i), i, tag);
                await session.saveChanges();
            }

            // in java we add one millisecond as we always operate on ms precision
            let entries = await session.timeSeriesFor(docId, timeSeriesName)
                .get(addMilliseconds(addDays(baseline, 9), 1), addDays(baseline, 11));
            assertThat(entries)
                .hasSize(1);

            // in java we add one millisecond as we always operate on ms precision
            entries = await session.timeSeriesFor(docId, timeSeriesName).get(
                addMilliseconds(addDays(baseline, 1), 1),
                null
            );
            assertThat(entries)
                .hasSize(9);

            session.timeSeriesFor(docId, timeSeriesName)
                .delete(addDays(baseline, 6), null);
            await session.saveChanges();

            const entries2 = await session.timeSeriesFor(docId, timeSeriesName)
                .get();
            assertThat(entries2)
                .hasSize(5);

        }
    })
});

