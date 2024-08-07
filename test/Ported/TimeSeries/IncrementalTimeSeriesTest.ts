import { HEADERS } from "../../../src/Constants.js";
import {
    ConfigureTimeSeriesOperation, GetTimeSeriesOperation,
    IDocumentStore,
    TimeSeriesCollectionConfiguration,
    TimeSeriesConfiguration,
    TimeSeriesEntry,
    TimeSeriesPolicy
} from "../../../src/index.js";
import { disposeTestDocumentStore, RavenTestContext, testContext } from "../../Utils/TestUtil.js";
import { User } from "../../Assets/Entities.js";
import { assertThat, assertThrows } from "../../Utils/AssertExtensions.js";
import { TimeValue } from "../../../src/Primitives/TimeValue.js";
import { delay } from "../../../src/Utility/PromiseUtil.js";
import { addDays, addMinutes, addSeconds } from "date-fns";


const INCREMENTAL_TS_NAME = HEADERS.INCREMENTAL_TIME_SERIES_PREFIX + "HeartRate";

describe("IncrementalTimeSeriesTest", function () {
    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("incrementOperationsWithSameTimestampOnDifferentSessionsShouldWork", async () => {
        const baseline = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            await session.store(user, "users/ayende");

            const ts = session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME);
            ts.increment(baseline, 100_000);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const ts = session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME);
            ts.increment(baseline, 100_000);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const ts = await session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME)
                .get(baseline, null);
            assertThat(ts)
                .hasSize(1);
            assertThat(ts[0].value)
                .isEqualTo(200_000);
        }
    });

    it("shouldIncrementValueOnEditIncrementalEntry", async () => {
        const baseline = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            await session.store(user, "users/ayende");

            const ts = session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME);
            ts.increment(baseline, 4);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const ts = session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME);
            ts.increment(baseline, 6);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const ts = await session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME)
                .get(baseline, baseline);
            assertThat(ts)
                .hasSize(1);
            assertThat(ts[0].value)
                .isEqualTo(10);
        }
    });

    it("getTagForIncremental", async () => {
        const baseline = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            await session.store(user, "users/ayende");

            const ts = session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME);
            ts.increment(baseline, 4);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const ts = await session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME)
                .get(baseline, baseline);
            assertThat(ts)
                .hasSize(1);
            assertThat(ts[0].value)
                .isEqualTo(4);
            assertThat(ts[0].tag)
                .startsWith("TC:INC");
        }
    });

    it("shouldIncrementValueOnEditIncrementalEntry2", async () => {
        const baseline = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            await session.store(user, "users/ayende");
            const ts = session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME);
            ts.increment(baseline, [1,1,1]);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const ts = session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME);
            ts.increment(baseline, [0,0,9]);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const ts = await session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME)
                .get(baseline, baseline);
            assertThat(ts)
                .hasSize(1);
            assertThat(ts[0].values)
                .hasSize(3);
            assertThat(ts[0].values[0])
                .isEqualTo(1);
            assertThat(ts[0].values[1])
                .isEqualTo(1);
            assertThat(ts[0].values[2])
                .isEqualTo(10);
        }
    });

    it("shouldIncrementValueOnEditIncrementalEntry3", async () => {
        const baseline = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            await session.store(user, "users/ayende");
            const ts = session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME);
            ts.increment(baseline, [1]);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const ts = session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME);
            ts.increment(baseline, [2, 10, 9]);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const ts = await session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME)
                .get(baseline, baseline);

            assertThat(ts)
                .hasSize(1);
            assertThat(ts[0].values)
                .hasSize(3);
            assertThat(ts[0].values[0])
                .isEqualTo(3);
            assertThat(ts[0].values[1])
                .isEqualTo(10);
            assertThat(ts[0].values[2])
                .isEqualTo(9);
        }
    });

    it("shouldIncrementValueOnEditIncrementalEntry4", async () => {
        const baseline = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            await session.store(user, "users/ayende");
            const ts = session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME);
            ts.increment(baseline, [1, 0]);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const ts = session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME);
            ts.increment(addMinutes(baseline, 1), [1, -3, 0, 0]);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const ts = session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME);
            ts.increment(baseline, [0, 0, 0, 0]);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const ts = await session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME)
                .get();

            assertThat(ts)
                .hasSize(2);
            assertThat(ts[0].values)
                .hasSize(4);
            assertThat(ts[0].values[0])
                .isEqualTo(1);
            assertThat(ts[0].values[1])
                .isEqualTo(0);
            assertThat(ts[0].values[2])
                .isEqualTo(0);
            assertThat(ts[0].values[3])
                .isEqualTo(0);

            assertThat(ts[1].values)
                .hasSize(4);
            assertThat(ts[1].values[0])
                .isEqualTo(1);
            assertThat(ts[1].values[1])
                .isEqualTo(-3);
            assertThat(ts[1].values[2])
                .isEqualTo(0);
            assertThat(ts[1].values[3])
                .isEqualTo(0);
        }
    });

    it("shouldSplitOperationsIfIncrementContainBothPositiveNegativeValues", async () => {
        const baseline = testContext.utcToday();
        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            await session.store(user, "users/ayende");
            const ts = session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME);
            ts.increment(baseline, [1, -2, 3]);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const ts = await session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME)
                .get(baseline, baseline);

            assertThat(ts)
                .hasSize(1);
            assertThat(ts[0].values)
                .hasSize(3);
            assertThat(ts[0].values[0])
                .isEqualTo(1);
            assertThat(ts[0].values[1])
                .isEqualTo(-2);
            assertThat(ts[0].values[2])
                .isEqualTo(3);
        }
    });

    it("multipleOperationsOnIncrementalTimeSeries", async () => {
        const baseline = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            await session.store(user, "users/ayende");
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const ts = session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME);
            for (let i = 0; i < 10_000; i++) {
                ts.increment(addMinutes(baseline, i), i);
            }
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const ts = await session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME).get();
            assertThat(ts)
                .hasSize(10_000);
        }
    });

    (RavenTestContext.isPullRequest ? it.skip : it)("shouldThrowIfIncrementOperationOnRollupTimeSeries", async () => {
        const p1 = new TimeSeriesPolicy("BySecond", TimeValue.ofSeconds(1));

        const collectionConfig = new TimeSeriesCollectionConfiguration();
        collectionConfig.policies = [p1];

        const config = new TimeSeriesConfiguration();
        config.collections.set("Users", collectionConfig);

        await store.maintenance.send(new ConfigureTimeSeriesOperation(config));

        const baseline = addDays(testContext.utcToday(), -1);

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Karmel";
            await session.store(user, "users/karmel");

            for (let i = 0; i < 100; i++) {
                session.incrementalTimeSeriesFor("users/karmel", INCREMENTAL_TS_NAME)
                    .increment(addSeconds(baseline, 4 * i), [29 * i]);
            }

            await session.saveChanges();
        }

        // wait for rollups to run

        await delay(1200);

        {
            const session = store.openSession();
            await session.incrementalTimeSeriesFor("users/karmel", INCREMENTAL_TS_NAME)
                .get();
        }

        {
            const session = store.openSession();
            await assertThrows(() =>
                    session.incrementalTimeSeriesFor("users/karmel", p1.getTimeSeriesName(INCREMENTAL_TS_NAME)).get()
                , err => {
                    assertThat(err.name)
                        .isEqualTo("InvalidArgumentException");
                    assertThat(err.message)
                        .contains("Time Series from type Rollup cannot be Incremental");
                })
        }
    });

    it("mergeDecAndIncForNodesValues", async () => {
        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            await session.store(user, "users/ayende");
            await session.saveChanges();
        }

        const time = testContext.utcToday();

        {
            const session = store.openSession();
            const ts = session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME);
            ts.increment(time, 1);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const ts = session.incrementalTimeSeriesFor("users/ayende", INCREMENTAL_TS_NAME);
            ts.increment(time, -1);
            await session.saveChanges();
        }

        const values = await store.operations.send(
            new GetTimeSeriesOperation("users/ayende", INCREMENTAL_TS_NAME, null, null, 0, 10, null, true));

        assertThat(values.totalResults)
            .isEqualTo(1);
        const result = values.entries[0];
        assertThat(result.value)
            .isEqualTo(0);

        assertThat(Object.keys(result.nodeValues))
            .hasSize(1);

    });

    it("shouldThrowIfIncrementalTimeSeriesReceiveNameWithoutIncrementalPrefix", async () => {
        const baseline = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";

            await session.store(user, "users/ayende");
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            await assertThrows(async () => {
                session.incrementalTimeSeriesFor("users/karmel", "Heartrate")
                    .increment(baseline, [29]);
                await session.saveChanges();
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .contains("Time Series name must start with");
            })
        }
    });
});

function timeSeriesEntryEquals(entryA: TimeSeriesEntry, entryB: TimeSeriesEntry) {
    if (entryA.timestamp.getTime() !== entryB.timestamp.getTime()) {
        return false;
    }

    if (entryA.values.length !== entryB.values.length) {
        return false;
    }

    for (let i = 0; i < entryA.values.length; i++) {
        if (Math.abs(entryA.values[i] - entryB.values[i]) != 0) {
            return false;
        }
    }

    if (entryA.tag !== entryB.tag) {
        return false;
    }

    return entryA.isRollup === entryB.isRollup;
}
