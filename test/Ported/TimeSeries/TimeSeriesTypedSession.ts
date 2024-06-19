import { disposeTestDocumentStore, RavenTestContext, testContext } from "../../Utils/TestUtil.js";
import {
    GetDatabaseRecordOperation,
    IDocumentStore,
    TimeSeriesValue,
    TimeSeriesAggregationResult,
    TimeSeriesRawResult,
    RawTimeSeriesPolicy,
    TimeSeriesPolicy,
    TimeSeriesConfiguration,
    TimeSeriesCollectionConfiguration,
    ConfigureTimeSeriesOperation,
    ISessionDocumentRollupTypedTimeSeries,
    TypedTimeSeriesRollupEntry
} from "../../../src/index.js";
import { User } from "../../Assets/Entities.js";
import { assertThat } from "../../Utils/AssertExtensions.js";
import moment from "moment";
import { TimeValue } from "../../../src/Primitives/TimeValue.js";
import { delay } from "../../../src/Utility/PromiseUtil.js";

(RavenTestContext.isPullRequest ? describe.skip : describe)("TimeSeriesTypedSessionTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canRegisterTimeSeries", async () => {
        await store.timeSeries.register(User, StockPrice);
        await store.timeSeries.register("Users", "HeartRateMeasures", [ "heartRate" ]);

        const updated = (await store.maintenance.server.send(
            new GetDatabaseRecordOperation(store.database))).timeSeries;

        // this method is case insensitive

        const heartRate = updated.getNames("users", "HeartRateMeasures");
        assertThat(heartRate)
            .hasSize(1);
        assertThat(heartRate[0])
            .isEqualTo("heartRate");

        const stock = updated.getNames("users", "StockPrices");
        assertThat(stock)
            .hasSize(5);
        assertThat(stock[0])
            .isEqualTo("open");
        assertThat(stock[1])
            .isEqualTo("close");
        assertThat(stock[2])
            .isEqualTo("high");
        assertThat(stock[3])
            .isEqualTo("low");
        assertThat(stock[4])
            .isEqualTo("volume");
    });

    it("canRegisterTimeSeriesWithCustomName", async () => {
        await store.timeSeries.register(User, HeartRateMeasureWithCustomName, "cn");

        const updated = (await store.maintenance.server.send(new GetDatabaseRecordOperation(store.database))).timeSeries;

        // this method is case insensitive
        const heartRate = updated.getNames("users", "cn");
        assertThat(heartRate)
            .hasSize(1);
        assertThat(heartRate[0])
            .isEqualTo("HR");
    });

    it("canRegisterTimeSeriesForOtherDatabase", async () => {
        const store1 = await testContext.getDocumentStore();
        try {
            const store2 = await testContext.getDocumentStore();
            try {
                await store1.timeSeries.forDatabase(store2.database).register(User, StockPrice);
                await store1.timeSeries.forDatabase(store2.database).register("Users", "HeartRateMeasures", [ "HeartRate" ]);

                const updated = (await store1.maintenance.server.send(
                    new GetDatabaseRecordOperation(store2.database))).timeSeries;

                assertThat(updated)
                    .isNotNull();

                const heartrate = updated.getNames("users", "HeartRateMeasures");
                assertThat(heartrate)
                    .hasSize(1);
                assertThat(heartrate[0])
                    .isEqualTo("HeartRate");

                const stock = updated.getNames("users", "StockPrices");
                assertThat(stock)
                    .hasSize(5);
                assertThat(stock[0])
                    .isEqualTo("open");
                assertThat(stock[1])
                    .isEqualTo("close");
                assertThat(stock[2])
                    .isEqualTo("high");
                assertThat(stock[3])
                    .isEqualTo("low");
                assertThat(stock[4])
                    .isEqualTo("volume");
            } finally {
                store2.dispose();
            }
        } finally {
            store1.dispose();
        }
    });

    it("canCreateSimpleTimeSeries", async () => {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            await session.store(user, "users/ayende");

            const heartRateMeasure = new HeartRateMeasure();
            heartRateMeasure.heartRate = 59;

            const ts = session.timeSeriesFor<HeartRateMeasure>("users/ayende", HeartRateMeasure);
            ts.append(baseLine.toDate(), heartRateMeasure, "watches/fitbit");
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const val = (await session.timeSeriesFor<HeartRateMeasure>("users/ayende", HeartRateMeasure).get())[0];
            assertThat(val.value.heartRate)
                .isEqualTo(59);
            assertThat(val.tag)
                .isEqualTo("watches/fitbit");
            assertThat(val.timestamp.getTime())
                .isEqualTo(baseLine.toDate().getTime());
        }
    });

    it("canCreateSimpleTimeSeries2", async () => {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            await session.store(user, "users/ayende");

            const tsf = session.timeSeriesFor("users/ayende", "HeartRateMeasures");
            tsf.append(baseLine.clone().add(1, "minutes").toDate(), 59, "watches/fitbit");
            tsf.append(baseLine.clone().add(2, "minutes").toDate(), 60, "watches/fitbit");
            tsf.append(baseLine.clone().add(2, "minutes").toDate(), 61, "watches/fitbit");

            await session.saveChanges()
        }

        {
            const session = store.openSession();
            const val = await session.timeSeriesFor<HeartRateMeasure>("users/ayende", HeartRateMeasure).get();

            assertThat(val)
                .hasSize(2);

            assertThat(val[0].value.heartRate)
                .isEqualTo(59);
            assertThat(val[1].value.heartRate)
                .isEqualTo(61);
        }
    });

    it("canRequestNonExistingTimeSeriesRange", async () => {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            await session.store(user, "users/ayende");

            const tsf = session.timeSeriesFor("users/ayende", "HeartRateMeasures");
            tsf.append(baseLine.toDate(), 58, "watches/fitbit");
            tsf.append(baseLine.clone().add(10, "minutes").toDate(), 60, "watches/fitbit");

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            let vals = await session.timeSeriesFor("users/ayende", HeartRateMeasure)
                .get(baseLine.clone().add(-10, "minutes").toDate(), baseLine.clone().add(-5, "minutes").toDate());

            assertThat(vals)
                .hasSize(0);

            vals = await session.timeSeriesFor("users/ayende", HeartRateMeasure)
                .get(baseLine.clone().add(5, "minutes").toDate(), baseLine.clone().add(9, "minutes").toDate());

            assertThat(vals)
                .hasSize(0);
        }
    });

    it("canGetTimeSeriesNames", async () => {
        {
            const session = store.openSession();
            await session.store(new User(), "users/karmel");
            const heartRateMeasure = new HeartRateMeasure();
            heartRateMeasure.heartRate = 66;

            session.timeSeriesFor("users/karmel", HeartRateMeasure)
                .append(new Date(), heartRateMeasure, "MyHeart");

            const stockPrice = new StockPrice();
            stockPrice.open = 66;
            stockPrice.close = 55;
            stockPrice.high = 113.4;
            stockPrice.low = 52.4;
            stockPrice.volume = 15472;

            session.timeSeriesFor("users/karmel", StockPrice)
                .append(new Date(), stockPrice);

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const user = await session.load<User>("users/karmel", User);
            const tsNames = session.advanced.getTimeSeriesFor(user);
            assertThat(tsNames)
                .hasSize(2);

            // should be sorted
            assertThat(tsNames[0])
                .isEqualTo("HeartRateMeasures");
            assertThat(tsNames[1])
                .isEqualTo("StockPrices");

            const heartRateMeasures = (await session.timeSeriesFor<HeartRateMeasure>(user, HeartRateMeasure).get())[0];

            assertThat(heartRateMeasures.value.heartRate)
                .isEqualTo(66);

            const stockPriceEntry = (await session.timeSeriesFor<StockPrice>(user, StockPrice).get())[0];
            assertThat(stockPriceEntry.value.open)
                .isEqualTo(66);
            assertThat(stockPriceEntry.value.close)
                .isEqualTo(55);
            assertThat(stockPriceEntry.value.high)
                .isEqualTo(113.4);
            assertThat(stockPriceEntry.value.low)
                .isEqualTo(52.4);
            assertThat(stockPriceEntry.value.volume)
                .isEqualTo(15472);
        }
    });

    it("canQueryTimeSeriesAggregation_DeclareSyntax_AllDocsQuery", async () => {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            await session.store(user, "users/ayende");

            const tsf = session.timeSeriesFor<HeartRateMeasure>("users/ayende", HeartRateMeasure);
            const tag = "watches/fitbit";
            const m = new HeartRateMeasure();
            m.heartRate = 59;
            tsf.append(baseLine.clone().add(61, "minutes").toDate(), m, tag);

            m.heartRate = 79;
            tsf.append(baseLine.clone().add(62, "minutes").toDate(), m, tag);

            m.heartRate = 69;
            tsf.append(baseLine.clone().add(63, "minutes").toDate(), m, tag);

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const query = session.advanced.rawQuery( "declare timeseries out(u)\n" +
                    "    {\n" +
                    "        from u.HeartRateMeasures between $start and $end\n" +
                    "        group by 1h\n" +
                    "        select min(), max(), first(), last()\n" +
                    "    }\n" +
                    "    from @all_docs as u\n" +
                    "    where id() == 'users/ayende'\n" +
                    "    select out(u)", TimeSeriesAggregationResult)
                .addParameter("start", baseLine.toDate())
                .addParameter("end", baseLine.clone().add(1, "day").toDate());

            const agg = (await query.first()).asTypedEntry<HeartRateMeasure>(HeartRateMeasure);

            assertThat(agg.count)
                .isEqualTo(3);
            assertThat(agg.results)
                .hasSize(1);

            const val = agg.results[0];
            assertThat(val.first.heartRate)
                .isEqualTo(59);
            assertThat(val.min.heartRate)
                .isEqualTo(59);

            assertThat(val.last.heartRate)
                .isEqualTo(69);
            assertThat(val.max.heartRate)
                .isEqualTo(79);

            assertThat(val.from.getTime())
                .isEqualTo(baseLine.clone().add(60, "minutes").toDate().getTime());
            assertThat(val.to.getTime())
                .isEqualTo(baseLine.clone().add(120, "minutes").toDate().getTime());
        }
    });

    it("canQueryTimeSeriesAggregation_NoSelectOrGroupBy", async () => {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            for (let i = 1; i <= 3; i++) {
                const id = "people/" + i;

                const user = new User();
                user.name = "Oren";
                user.age = i * 30;

                await session.store(user, id);

                const tsf = session.timeSeriesFor(id, HeartRateMeasure);
                const m = new HeartRateMeasure();
                m.heartRate = 59;
                tsf.append(baseLine.clone().add(61, "minutes").toDate(), m, "watches/fitbit");

                m.heartRate = 79;
                tsf.append(baseLine.clone().add(62, "minutes").toDate(), m, "watches/fitbit");

                m.heartRate = 69;
                tsf.append(baseLine.clone().add(63, "minutes").toDate(), m, "watches/apple");

                m.heartRate = 159;
                tsf.append(baseLine.clone().add(61, "minutes").add(1, "month").toDate(), m, "watches/fitbit");

                m.heartRate = 179;
                tsf.append(baseLine.clone().add(62, "minutes").add(1, "month").toDate(), m, "watches/apple");

                m.heartRate = 169;
                tsf.append(baseLine.clone().add(63, "minutes").add(1, "month").toDate(), m, "watches/fitbit");
            }

            await session.saveChanges();
        }

        {
            const session = store.openSession();

            const result = await session.advanced.rawQuery("declare timeseries out(x)\n" +
                "{\n" +
                "    from x.HeartRateMeasures between $start and $end\n" +
                "}\n" +
                "from Users as doc\n" +
                "where doc.age > 49\n" +
                "select out(doc)", TimeSeriesRawResult)
                .addParameter("start", baseLine.toDate())
                .addParameter("end", baseLine.clone().add(2, "months").toDate())
                .all();

            assertThat(result)
                .hasSize(2);

            for (let i = 0; i < 2; i++) {
                const aggRaw = result[i];
                const agg = aggRaw.asTypedResult<HeartRateMeasure>(HeartRateMeasure);

                assertThat(agg.results)
                    .hasSize(6);

                let val = agg.results[0];

                assertThat(val.values)
                    .hasSize(1);

                assertThat(val.value.heartRate)
                    .isEqualTo(59);

                assertThat(val.tag)
                    .isEqualTo("watches/fitbit");
                assertThat(val.timestamp.getTime())
                    .isEqualTo(baseLine.clone().add(61, "minutes").toDate().getTime());

                val = agg.results[1];

                assertThat(val.values)
                    .hasSize(1);
                assertThat(val.value.heartRate)
                    .isEqualTo(79);
                assertThat(val.tag)
                    .isEqualTo("watches/fitbit");
                assertThat(val.timestamp.getTime())
                    .isEqualTo(baseLine.clone().add(62, "minutes").toDate().getTime());

                val = agg.results[2];

                assertThat(val.values)
                    .hasSize(1);
                assertThat(val.value.heartRate)
                    .isEqualTo(69);
                assertThat(val.tag)
                    .isEqualTo("watches/apple");
                assertThat(val.timestamp.getTime())
                    .isEqualTo(baseLine.clone().add(63, "minutes").toDate().getTime());

                val = agg.results[3];

                assertThat(val.values)
                    .hasSize(1);
                assertThat(val.value.heartRate)
                    .isEqualTo(159);
                assertThat(val.tag)
                    .isEqualTo("watches/fitbit");
                assertThat(val.timestamp.getTime())
                    .isEqualTo(baseLine.clone().add(61, "minutes").add(1, "month").toDate().getTime());

                val = agg.results[4];

                assertThat(val.values)
                    .hasSize(1);
                assertThat(val.value.heartRate)
                    .isEqualTo(179);
                assertThat(val.tag)
                    .isEqualTo("watches/apple");
                assertThat(val.timestamp.getTime())
                    .isEqualTo(baseLine.clone().add(62, "minutes").add(1, "month").toDate().getTime());

                val = agg.results[5];

                assertThat(val.values)
                    .hasSize(1);
                assertThat(val.value.heartRate)
                    .isEqualTo(169);
                assertThat(val.tag)
                    .isEqualTo("watches/fitbit");
                assertThat(val.timestamp.getTime())
                    .isEqualTo(baseLine.clone().add(63, "minutes").add(1, "month").toDate().getTime());
            }
        }
    });
    it("canWorkWithRollupTimeSeries", async () => {
        const raw = new RawTimeSeriesPolicy(TimeValue.ofHours(24));
        const rawRetentionSeconds = raw.retentionTime.value;

        const p1 = new TimeSeriesPolicy("By6Hours", TimeValue.ofHours(6), TimeValue.ofSeconds(rawRetentionSeconds * 4));
        const p2 = new TimeSeriesPolicy("By1Day", TimeValue.ofDays(1), TimeValue.ofSeconds(rawRetentionSeconds * 5));
        const p3 = new TimeSeriesPolicy("By30Minutes", TimeValue.ofMinutes(30), TimeValue.ofSeconds(rawRetentionSeconds * 2));
        const p4 = new TimeSeriesPolicy("By1Hour", TimeValue.ofMinutes(60), TimeValue.ofSeconds(rawRetentionSeconds * 3));

        const config = new TimeSeriesConfiguration();

        const usersConfig = new TimeSeriesCollectionConfiguration();
        usersConfig.rawPolicy = raw;
        usersConfig.policies = [ p1, p2, p3, p4 ];

        config.collections.set("Users", usersConfig);

        config.policyCheckFrequencyInMs = 100;

        await store.maintenance.send(new ConfigureTimeSeriesOperation(config));
        await store.timeSeries.register(User, StockPrice);

        // please notice we don't modify server time here!

        let now = moment();
        const baseline = now.clone().add(-12, "days");

        const total = Math.floor(TimeValue.ofDays(12).value / 60);

        {
            const session = store.openSession();

            const user = new User();
            user.name = "Karmel";
            await session.store(user, "users/karmel");

            const ts = session.timeSeriesFor("users/karmel", StockPrice);

            const entry = new StockPrice();

            for (let i = 0; i <= total; i++) {
                entry.open = i;
                entry.close = i + 100_000;
                entry.high = i + 200_000;
                entry.low = i + 300_000;
                entry.volume = i + 400_000;

                ts.append(baseline.clone().add(i, "minute").toDate(), entry, "watches/fitbit");
            }

            await session.saveChanges();
        }

        await delay(1500); // wait for rollup

        {
            const session = store.openSession();
            const query = session.advanced.rawQuery("declare timeseries out()\n" +
                "{\n" +
                "    from StockPrices\n" +
                "    between $start and $end\n" +
                "}\n" +
                "from Users as u\n" +
                "select out()", TimeSeriesRawResult)
                .addParameter("start", baseline.clone().add(-1, "day").toDate())
                .addParameter("end", now.clone().add(1, "day").toDate());

            const resultRaw = await query.single();
            const result = resultRaw.asTypedResult<StockPrice>(StockPrice);

            assertThat(result.results.length)
                .isGreaterThan(0);

            for (const res of result.results) {
                if (res.isRollup) {
                    assertThat(res.values.length)
                        .isGreaterThan(0);
                    assertThat(res.value.low)
                        .isGreaterThan(0);
                    assertThat(res.value.high)
                        .isGreaterThan(0);
                } else {
                    assertThat(res.values)
                        .hasSize(5);
                }
            }
        }

        now = moment();

        {
            const session = store.openSession();
            const ts: ISessionDocumentRollupTypedTimeSeries<StockPrice>
                = session.timeSeriesRollupFor<StockPrice>("users/karmel", p1.name, StockPrice);
            const a = new TypedTimeSeriesRollupEntry<StockPrice>(StockPrice, new Date());
            a.max.close = 1;
            ts.append(a);

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const ts = session.timeSeriesRollupFor<StockPrice>("users/karmel", p1.name, StockPrice);
            const res = await ts.get(now.clone().add(-1, "millisecond").toDate(), now.clone().add(1, "day").toDate());

            assertThat(res)
                .hasSize(1);
            assertThat(res[0].max.close)
                .isEqualTo(1);
        }
    });

    it("usingDifferentNumberOfValues_LargeToSmall", async () => {
        const baseLine = testContext.utcToday().add(-1, "days");

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Karmel";
            await session.store(user, "users/karmel");

            const big = session.timeSeriesFor<BigMeasure>("users/karmel", BigMeasure);
            for (let i = 0; i < 5; i++) {
                const bigMeasure = Object.assign(new BigMeasure(), {
                    measure1: i,
                    measure2: i,
                    measure3: i,
                    measure4: i,
                    measure5: i,
                    measure6: i
                });

                big.append(baseLine.clone().add(3 * i, "seconds").toDate(), bigMeasure, "watches/fitbit");
            }

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const big = session.timeSeriesFor("users/karmel", "BigMeasures");

            for (let i = 5; i < 10; i++) {
                big.append(baseLine.clone().add(12, "hours").add(3 * i, "seconds").toDate(), i, "watches/fitbit");
            }

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const big = await session.timeSeriesFor<BigMeasure>("users/karmel", BigMeasure).get();

            for (let i = 0; i < 5; i++) {
                const m = big[i].value;
                assertThat(m.measure1)
                    .isEqualTo(i);
                assertThat(m.measure2)
                    .isEqualTo(i);
                assertThat(m.measure3)
                    .isEqualTo(i);
                assertThat(m.measure4)
                    .isEqualTo(i);
                assertThat(m.measure5)
                    .isEqualTo(i);
                assertThat(m.measure6)
                    .isEqualTo(i);
            }

            for (let i = 5; i < 10; i++) {
                const m = big[i].value;

                assertThat(m.measure1)
                    .isEqualTo(i);
                assertThat(m.measure2)
                    .isEqualTo(Number.NaN);
                assertThat(m.measure3)
                    .isEqualTo(Number.NaN);
                assertThat(m.measure4)
                    .isEqualTo(Number.NaN);
                assertThat(m.measure5)
                    .isEqualTo(Number.NaN);
                assertThat(m.measure6)
                    .isEqualTo(Number.NaN);
            }
        }
    });

    it("canWorkWithRollupTimeSeries2", async () => {
        const rawHours = 24;

        const raw = new RawTimeSeriesPolicy(TimeValue.ofHours(rawHours));

        const p1 = new TimeSeriesPolicy("By6Hours", TimeValue.ofHours(6), TimeValue.ofHours(rawHours * 4));
        const p2 = new TimeSeriesPolicy("By1Day", TimeValue.ofDays(1), TimeValue.ofHours(rawHours * 5));
        const p3 = new TimeSeriesPolicy("By30Minutes", TimeValue.ofMinutes(30), TimeValue.ofHours(rawHours * 2));
        const p4 = new TimeSeriesPolicy("By1Hour", TimeValue.ofMinutes(60), TimeValue.ofHours(rawHours * 3));

        const usersConfig = new TimeSeriesCollectionConfiguration();
        usersConfig.rawPolicy = raw;
        usersConfig.policies = [p1, p2, p3, p4];

        const config = new TimeSeriesConfiguration();
        config.policyCheckFrequencyInMs = 100;
        config.collections = new Map<string, TimeSeriesCollectionConfiguration>();
        config.collections.set("Users", usersConfig);

        await store.maintenance.send(new ConfigureTimeSeriesOperation(config));
        await store.timeSeries.register(User, StockPrice);

        const now = testContext.utcToday();
        const baseline = now.clone().add(-12, "days");
        const total = 60 * 24 * 12;

        {
            const session = store.openSession()
            const user = new User();
            user.name = "Karmel";
            await session.store(user, "users/karmel");
            const ts = session.timeSeriesFor("users/karmel", StockPrice);

            const entry = new StockPrice();
            for (let i = 0; i <= total; i++) {
                entry.open = i;
                entry.close = i + 100_000;
                entry.high = i + 200_000;
                entry.low = i + 300_000;
                entry.volume = i + 400_000;

                ts.append(baseline.clone().add(i, "minutes").toDate(), entry, "watches/fitbit");
            }

            await session.saveChanges();
        }

        await delay(1500); // wait for rollups

        {
            const session = store.openSession();
            const ts1 = session.timeSeriesRollupFor("users/karmel", p1.name, StockPrice);
            const r = (await ts1.get())[0];
            assertThat(r.first)
                .isNotNull();
            assertThat(r.last)
                .isNotNull();
            assertThat(r.min)
                .isNotNull();
            assertThat(r.max)
                .isNotNull();
            assertThat(r.count)
                .isNotNull();
            assertThat(r.average)
                .isNotNull();
        }
    });
});

export class StockPrice {
    public static readonly TIME_SERIES_VALUES: TimeSeriesValue<StockPrice> = ["open", "close", "high", "low", "volume"];

    public open: number;
    public close: number;
    public high: number;
    public low: number;
    public volume: number;
}

export class HeartRateMeasure {
    public static readonly TIME_SERIES_VALUES: TimeSeriesValue<HeartRateMeasure> = ["heartRate"];

    public heartRate: number;
}

class HeartRateMeasureWithCustomName {
    public static readonly TIME_SERIES_VALUES: TimeSeriesValue<HeartRateMeasure> = [ { field: "heartRate", name: "HR" } ];

    public heartRate: number;
}

class BigMeasure {

    public static readonly TIME_SERIES_VALUES: TimeSeriesValue<BigMeasure> = [
        "measure1",
        "measure2",
        "measure3",
        "measure4",
        "measure5",
        "measure6"
    ];

    public measure1: number;
    public measure2: number;
    public measure3: number;
    public measure4: number;
    public measure5: number;
    public measure6: number;

}
