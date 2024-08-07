import {
    GetMultipleTimeSeriesOperation,
    GetTimeSeriesOperation,
    GetTimeSeriesStatisticsOperation,
    IDocumentStore,
    SessionOptions,
    TimeSeriesBatchOperation,
    TimeSeriesOperation,
    AppendOperation,
    DeleteOperation
} from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { User } from "../../Assets/Entities.js";
import { assertThat, assertThrows } from "../../Utils/AssertExtensions.js";
import { RawQueryResult } from "./TimeSeriesRawQuery.js";
import { addDays, addMinutes, addMonths, addSeconds, addYears } from "date-fns";

describe("TimeSeriesOperations", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canCreateAndGetSimpleTimeSeriesUsingStoreOperations", async () => {
        const documentId = "users/ayende";

        {
            const session = store.openSession();
            const user = new User();
            await session.store(user, documentId);
            await session.saveChanges();
        }

        const baseLine = testContext.utcToday();

        const append1 = new AppendOperation(addSeconds(baseLine, 1), [ 59 ], "watches/fitbit");
        const timeSeriesOp = new TimeSeriesOperation("Heartrate");
        timeSeriesOp.append(append1);

        const timeSeriesBatch = new TimeSeriesBatchOperation(documentId, timeSeriesOp);

        await store.operations.send(timeSeriesBatch);

        const timeSeriesRangeResult = await store.operations.send(new GetTimeSeriesOperation(documentId, "Heartrate"));

        assertThat(timeSeriesRangeResult.entries)
            .hasSize(1);

        const value = timeSeriesRangeResult.entries[0];

        assertThat(value.values[0])
            .isEqualTo(59);
        assertThat(value.tag)
            .isEqualTo("watches/fitbit");
        assertThat(value.timestamp.getTime())
            .isEqualTo(addSeconds(baseLine, 1).getTime());
    });

    it("canGetNonExistedRange", async () => {
        {
            const session = store.openSession();
            const user = new User();
            await session.store(user, "users/ayende");
            await session.saveChanges();
        }

        const baseLine = testContext.utcToday();

        const timeSeriesOp = new TimeSeriesOperation("Heartrate");
        timeSeriesOp.append(new AppendOperation(addSeconds(baseLine, 1), [ 59 ], "watches/fitbit"));

        const timeSeriesBatch = new TimeSeriesBatchOperation("users/ayende", timeSeriesOp);
        await store.operations.send(timeSeriesBatch);

        const timeSeriesRangeResult = await store.operations.send(
            new GetTimeSeriesOperation(
                "users/ayende",
                "Heartrate",
                addMonths(baseLine, -2),
                addMonths(baseLine, -1)
            ));

        assertThat(timeSeriesRangeResult.entries)
            .hasSize(0);
    });

    it("canStoreAndReadMultipleTimestampsUsingStoreOperations", async () => {
        const documentId = "users/ayende";

        {
            const session = store.openSession();
            await session.store(new User(), documentId);
            await session.saveChanges();
        }

        const baseLine = testContext.utcToday();

        const timeSeriesOp = new TimeSeriesOperation("Heartrate");
        timeSeriesOp
            .append(new AppendOperation(addSeconds(baseLine, 1), [ 59 ], "watches/fitbit"));
        timeSeriesOp
            .append(new AppendOperation(addSeconds(baseLine, 2), [ 61 ], "watches/fitbit"));
        timeSeriesOp
            .append(new AppendOperation(addSeconds(baseLine, 5), [ 60 ], "watches/apple-watch"));

        const timeSeriesBatch = new TimeSeriesBatchOperation(documentId, timeSeriesOp);

        await store.operations.send(timeSeriesBatch);

        const timeSeriesRangeResult = await store.operations.send(new GetTimeSeriesOperation(documentId, "Heartrate"));

        assertThat(timeSeriesRangeResult.entries)
            .hasSize(3);

        let value = timeSeriesRangeResult.entries[0];

        assertThat(value.values[0])
            .isEqualTo(59);
        assertThat(value.tag)
            .isEqualTo("watches/fitbit");
        assertThat(value.timestamp.getTime())
            .isEqualTo(addSeconds(baseLine, 1).getTime());

        value = timeSeriesRangeResult.entries[1];

        assertThat(value.values[0])
            .isEqualTo(61);
        assertThat(value.tag)
            .isEqualTo("watches/fitbit");
        assertThat(value.timestamp.getTime())
            .isEqualTo(addSeconds(baseLine, 2).getTime());

        value = timeSeriesRangeResult.entries[2];

        assertThat(value.values[0])
            .isEqualTo(60);
        assertThat(value.tag)
            .isEqualTo("watches/apple-watch");
        assertThat(value.timestamp.getTime())
            .isEqualTo(addSeconds(baseLine, 5).getTime());
    });

    it("canDeleteTimestampUsingStoreOperations", async () => {
        const documentId = "users/ayende";

        {
            const session = store.openSession();
            await session.store(new User(), documentId);
            await session.saveChanges();
        }

        const baseLine = testContext.utcToday();

        let timeSeriesOp = new TimeSeriesOperation("Heartrate");

        timeSeriesOp.append(
            new AppendOperation(
                addSeconds(baseLine, 1), [ 59 ], "watches/fitbit"));

        timeSeriesOp.append(
            new AppendOperation(
                addSeconds(baseLine, 2), [ 61 ], "watches/fitbit"));

        timeSeriesOp.append(
            new AppendOperation(
                addSeconds(baseLine, 3), [ 60 ], "watches/fitbit"));

        timeSeriesOp.append(
            new AppendOperation(
                addSeconds(baseLine, 4), [ 62.5 ], "watches/fitbit"));

        timeSeriesOp.append(
            new AppendOperation(
                addSeconds(baseLine, 5), [ 62 ], "watches/fitbit"));

        let timeSeriesBatch = new TimeSeriesBatchOperation(documentId, timeSeriesOp);

        await store.operations.send(timeSeriesBatch);

        let timeSeriesRangeResult = await store.operations.send(
            new GetTimeSeriesOperation(documentId, "Heartrate", null, null)
        );

        assertThat(timeSeriesRangeResult.entries)
            .hasSize(5);

        timeSeriesOp = new TimeSeriesOperation("Heartrate");
        timeSeriesOp.delete(
            new DeleteOperation(
                addSeconds(baseLine, 2), addSeconds(baseLine, 3)));

        timeSeriesBatch = new TimeSeriesBatchOperation(documentId, timeSeriesOp);

        await store.operations.send(timeSeriesBatch);

        timeSeriesRangeResult = await store.operations.send(new GetTimeSeriesOperation(documentId, "Heartrate", null, null));

        assertThat(timeSeriesRangeResult.entries)
            .hasSize(3);

        let value = timeSeriesRangeResult.entries[0];

        assertThat(value.values[0])
            .isEqualTo(59);
        assertThat(value.timestamp.getTime())
            .isEqualTo(addSeconds(baseLine, 1).getTime());

        value = timeSeriesRangeResult.entries[1];

        assertThat(value.values[0])
            .isEqualTo(62.5);
        assertThat(value.timestamp.getTime())
            .isEqualTo(addSeconds(baseLine, 4).getTime());

        value = timeSeriesRangeResult.entries[2];

        assertThat(value.values[0])
            .isEqualTo(62);
        assertThat(value.timestamp.getTime())
            .isEqualTo(addSeconds(baseLine, 5).getTime());

        {
            const session = store.openSession();
            await session.delete(documentId);
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            await session.store(user, documentId);
            await session.saveChanges();

            const tsf = session.timeSeriesFor(documentId, "Heartrate");
            tsf.append(addMinutes(baseLine, 1), [ 59 ], "watches/fitbit");
            tsf.append(addMinutes(baseLine, 2), [ 69 ], "watches/fitbit");
            tsf.append(addMinutes(baseLine, 3), [ 79 ], "watches/fitbit");

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            await session.store(user, documentId);
            session.timeSeriesFor(documentId, "Heartrate")
                .deleteAt(addMinutes(baseLine, 2));
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const vals = await session.timeSeriesFor(documentId, "Heartrate").get();

            assertThat(vals)
                .hasSize(2);

            assertThat(vals[0].values)
                .hasSize(1);
            assertThat(vals[0].value)
                .isEqualTo(59);
            assertThat(vals[0].tag)
                .isEqualTo("watches/fitbit");
            assertThat(vals[0].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 1).getTime());

            assertThat(vals[1].values)
                .hasSize(1);
            assertThat(vals[1].value)
                .isEqualTo(79);
            assertThat(vals[1].tag)
                .isEqualTo("watches/fitbit");
            assertThat(vals[1].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 3).getTime());
        }
    });

    it("canDeleteLargeRange", async () => {
        const baseLine = addSeconds(testContext.utcToday(), -1);

        {
            const session = store.openSession();
            await session.store(new User(), "foo/bar");
            const tsf = await session.timeSeriesFor("foo/bar", "BloodPressure");

            for (let j = 1; j < 10_000; j++) {
                const offset = j * 10;
                const time = addSeconds(baseLine, offset);

                tsf.append(time, [ j ], "watches/apple");
            }

            await session.saveChanges();
        }

        const rawQuery = "declare timeseries blood_pressure(doc)\n" +
            "  {\n" +
            "      from doc.BloodPressure between $start and $end\n" +
            "      group by 1h\n" +
            "      select min(), max(), avg(), first(), last()\n" +
            "  }\n" +
            "  from Users as p\n" +
            "  select blood_pressure(p) as bloodPressure";
        
        {
            const session = store.openSession();
            const query = session.advanced.rawQuery(rawQuery, RawQueryResult)
                .addParameter("start", baseLine)
                .addParameter("end", addDays(baseLine, 1));

            const result = await query.all();

            assertThat(result)
                .hasSize(1);

            const agg = result[0];

            const bloodPressure = agg.bloodPressure;
            const count = bloodPressure.results.map(x => x.count[0]).reduce((a, b) => a + b, 0);
            assertThat(count)
                .isEqualTo(8640);
            assertThat(count)
                .isEqualTo(bloodPressure.count);
            assertThat(bloodPressure.results.length)
                .isEqualTo(24);

            for (let index = 0; index < bloodPressure.results.length; index++) {
                const item = bloodPressure.results[index];

                assertThat(item.count[0])
                    .isEqualTo(360);
                assertThat(item.average[0])
                    .isEqualTo(index * 360 + 180 + 0.5);
                assertThat(item.max[0])
                    .isEqualTo((index + 1) * 360);
                assertThat(item.min[0])
                    .isEqualTo(index * 360 + 1);
                assertThat(item.first[0])
                    .isEqualTo(index * 360 + 1);
                assertThat(item.last[0])
                    .isEqualTo((index + 1) * 360);
            }

            {
                const session = store.openSession();
                const tsf = session.timeSeriesFor("foo/bar", "BloodPressure");
                tsf.delete(addSeconds(baseLine, 3600), addSeconds(baseLine, 3600 * 10)); // remove 9 hours
                await session.saveChanges();
            }

            const sessionOptions: SessionOptions = {
                noCaching: true
            };

            {
                const session = store.openSession(sessionOptions);
                const query = session.advanced.rawQuery(rawQuery, RawQueryResult)
                    .addParameter("start", baseLine)
                    .addParameter("end", addDays(baseLine, 1));

                const result = await query.all();

                const agg = result[0];

                const bloodPressure = agg.bloodPressure;
                const count = bloodPressure.results.map(x => x.count[0]).reduce((a, b) => a + b, 0);
                assertThat(count)
                    .isEqualTo(5399);
                assertThat(count)
                    .isEqualTo(bloodPressure.count);
                assertThat(bloodPressure.results.length)
                    .isEqualTo(15);

                let index = 0;

                let item = bloodPressure.results[index];
                assertThat(item.count[0])
                    .isEqualTo(359);
                assertThat(item.average[0])
                    .isEqualTo(180);
                assertThat(item.max[0])
                    .isEqualTo(359);
                assertThat(item.min[0])
                    .isEqualTo(1);
                assertThat(item.first[0])
                    .isEqualTo(1);
                assertThat(item.last[0])
                    .isEqualTo(359);

                for (index = 1; index < bloodPressure.results.length; index++) {
                    item = bloodPressure.results[index];
                    const realIndex = index + 9;

                    assertThat(item.count[0])
                        .isEqualTo(360);
                    assertThat(item.average[0])
                        .isEqualTo(realIndex * 360 + 180 + 0.5);
                    assertThat(item.max[0])
                        .isEqualTo((realIndex + 1) * 360);
                    assertThat(item.min[0])
                        .isEqualTo(realIndex * 360 + 1);
                    assertThat(item.first[0])
                        .isEqualTo(realIndex * 360 + 1);
                    assertThat(item.last[0])
                        .isEqualTo((realIndex + 1) * 360);
                }
            }
        }
    });

    it("canAppendAndRemoveTimestampsInSingleBatch", async () => {
        const documentId = "users/ayende";

        {
            const session = store.openSession();
            await session.store(new User(), documentId);
            await session.saveChanges();
        }

        const baseLine = testContext.utcToday();

        let timeSeriesOp = new TimeSeriesOperation("Heartrate");
        timeSeriesOp.append(new AppendOperation(addSeconds(baseLine, 1), [ 59 ], "watches/fitbit"));
        timeSeriesOp.append(new AppendOperation(addSeconds(baseLine, 2), [ 61 ], "watches/fitbit"));
        timeSeriesOp.append(new AppendOperation(addSeconds(baseLine, 3), [ 61.5 ], "watches/fitbit"));

        let timeSeriesBatch = new TimeSeriesBatchOperation(documentId, timeSeriesOp);

        await store.operations.send(timeSeriesBatch);

        let timeSeriesRangeResult = await store.operations.send(new GetTimeSeriesOperation(documentId, "Heartrate", null, null));
        assertThat(timeSeriesRangeResult.entries)
            .hasSize(3);

        timeSeriesOp = new TimeSeriesOperation("Heartrate");
        timeSeriesOp.append(new AppendOperation(addSeconds(baseLine, 4), [ 60 ], "watches/fitbit"));
        timeSeriesOp.append(new AppendOperation(addSeconds(baseLine, 5), [ 62.5 ], "watches/fitbit"));
        timeSeriesOp.append(new AppendOperation(addSeconds(baseLine, 6), [ 62 ], "watches/fitbit"));

        timeSeriesOp.delete(new DeleteOperation(addSeconds(baseLine, 2), addSeconds(baseLine, 3)));

        timeSeriesBatch = new TimeSeriesBatchOperation(documentId, timeSeriesOp);

        await store.operations.send(timeSeriesBatch);

        timeSeriesRangeResult = await store.operations.send(new GetTimeSeriesOperation(documentId, "Heartrate", null, null));

        assertThat(timeSeriesRangeResult.entries)
            .hasSize(4);

        let value = timeSeriesRangeResult.entries[0];
        assertThat(value.values[0])
            .isEqualTo(59);
        assertThat(value.timestamp.getTime())
            .isEqualTo(addSeconds(baseLine, 1).getTime());

        value = timeSeriesRangeResult.entries[1];
        assertThat(value.values[0])
            .isEqualTo(60);
        assertThat(value.timestamp.getTime())
            .isEqualTo(addSeconds(baseLine, 4).getTime());

        value = timeSeriesRangeResult.entries[2];
        assertThat(value.values[0])
            .isEqualTo(62.5);
        assertThat(value.timestamp.getTime())
            .isEqualTo(addSeconds(baseLine, 5).getTime());

        value = timeSeriesRangeResult.entries[3];
        assertThat(value.values[0])
            .isEqualTo(62);
        assertThat(value.timestamp.getTime())
            .isEqualTo(addSeconds(baseLine, 6).getTime());
    });

    it("shouldThrowOnAttemptToCreateTimeSeriesOnMissingDocument", async () => {
        const baseLine = testContext.utcToday();

        const timeSeriesOp = new TimeSeriesOperation("Heartrate");
        timeSeriesOp.append(new AppendOperation(addSeconds(baseLine, 1), [ 59 ], "watches/fitbit"));

        const timeSeriesBatch = new TimeSeriesBatchOperation("users/ayende", timeSeriesOp);
        await assertThrows(async () => {
            return store.operations.send(timeSeriesBatch)
        }, err => {
            assertThat(err.name)
                .isEqualTo("DocumentDoesNotExistException");
            assertThat(err.message)
                .contains("Cannot operate on time series of a missing document");
        });
    });

    it("canGetMultipleRangesInSingleRequest", async () => {
        const documentId = "users/ayende";

        {
            const session = store.openSession();
            await session.store(new User(), documentId);
            await session.saveChanges();
        }

        const baseLine = testContext.utcToday();

        const timeSeriesOp = new TimeSeriesOperation("Heartrate");

        for (let i = 0; i <= 360; i++) {
            timeSeriesOp.append(new AppendOperation(addSeconds(baseLine, i * 10), [ 59 ], "watches/fitbit"));
        }

        const timeSeriesBatch = new TimeSeriesBatchOperation(documentId, timeSeriesOp);
        await store.operations.send(timeSeriesBatch);

        const timeSeriesDetails = await store.operations.send(new GetMultipleTimeSeriesOperation(documentId, [
            {
                name: "Heartrate",
                from: addMinutes(baseLine, 5),
                to: addMinutes(baseLine, 10)
            },
            {
                name: "Heartrate",
                from: addMinutes(baseLine, 15),
                to: addMinutes(baseLine, 30)
            },
            {
                name: "Heartrate",
                from: addMinutes(baseLine, 40),
                to: addMinutes(baseLine, 60)
            }
        ]));

        assertThat(timeSeriesDetails.id)
            .isEqualTo(documentId);
        assertThat(timeSeriesDetails.values)
            .hasSize(1);
        assertThat(timeSeriesDetails.values.get("Heartrate"))
            .hasSize(3);

        let range = timeSeriesDetails.values.get("Heartrate")[0];

        assertThat(range.from.getTime())
            .isEqualTo(addMinutes(baseLine, 5).getTime());
        assertThat(range.to.getTime())
            .isEqualTo(addMinutes(baseLine, 10).getTime());

        assertThat(range.entries)
            .hasSize(31);

        assertThat(range.entries[0].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, 5).getTime());
        assertThat(range.entries[30].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, 10).getTime());

        range = timeSeriesDetails.values.get("Heartrate")[1];

        assertThat(range.from.getTime())
            .isEqualTo(addMinutes(baseLine, 15).getTime());
        assertThat(range.to.getTime())
            .isEqualTo(addMinutes(baseLine, 30).getTime());

        assertThat(range.entries)
            .hasSize(91);

        assertThat(range.entries[0].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, 15).getTime());
        assertThat(range.entries[90].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, 30).getTime());

        range = timeSeriesDetails.values.get("Heartrate")[2];

        assertThat(range.from.getTime())
            .isEqualTo(addMinutes(baseLine, 40).getTime());
        assertThat(range.to.getTime())
            .isEqualTo(addMinutes(baseLine, 60).getTime());

        assertThat(range.entries)
            .hasSize(121);

        assertThat(range.entries[0].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, 40).getTime());
        assertThat(range.entries[120].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, 60).getTime());
    });

    it("canGetMultipleTimeSeriesInSingleRequest", async () => {
        const documentId = "users/ayende";

        {
            const session = store.openSession();
            await session.store(new User(), documentId);
            await session.saveChanges();
        }

        // append

        const baseLine = testContext.utcToday();

        let timeSeriesOp = new TimeSeriesOperation("Heartrate");

        for (let i = 0; i <= 10; i++) {
            timeSeriesOp.append(new AppendOperation(addMinutes(baseLine, i * 10), [ 72 ], "watches/fitbit"));
        }

        let timeSeriesBatch = new TimeSeriesBatchOperation(documentId, timeSeriesOp);

        await store.operations.send(timeSeriesBatch);

        timeSeriesOp = new TimeSeriesOperation("BloodPressure");

        for (let i = 0; i <= 10; i++) {
            timeSeriesOp.append(new AppendOperation(addMinutes(baseLine, i * 10), [ 80 ]));
        }

        timeSeriesBatch = new TimeSeriesBatchOperation(documentId, timeSeriesOp);

        await store.operations.send(timeSeriesBatch);

        timeSeriesOp = new TimeSeriesOperation("Temperature");

        for (let i = 0; i <= 10; i++) {
            timeSeriesOp.append(new AppendOperation(addMinutes(baseLine, i * 10), [ 37 + i * 0.15 ]));
        }

        timeSeriesBatch = new TimeSeriesBatchOperation(documentId, timeSeriesOp);

        await store.operations.send(timeSeriesBatch);

        // get ranges from multiple time series in a single request

        const timeSeriesDetails = await store.operations.send(new GetMultipleTimeSeriesOperation(documentId, [
            {
                name: "Heartrate",
                from: baseLine,
                to: addMinutes(baseLine, 15)
            }, {
                name: "Heartrate",
                from: addMinutes(baseLine, 30),
                to: addMinutes(baseLine, 45)
            }, {
                name: "BloodPressure",
                from: baseLine,
                to: addMinutes(baseLine, 30)
            }, {
                name: "BloodPressure",
                from: addMinutes(baseLine, 60),
                to: addMinutes(baseLine, 90)
            }, {
                name: "Temperature",
                from: baseLine,
                to: addDays(baseLine, 1)
            }
        ]));

        assertThat(timeSeriesDetails.id)
            .isEqualTo("users/ayende");

        assertThat(timeSeriesDetails.values)
            .hasSize(3);

        assertThat(timeSeriesDetails.values.get("Heartrate"))
            .hasSize(2);

        let range = timeSeriesDetails.values.get("Heartrate")[0];

        assertThat(range.from.getTime())
            .isEqualTo(baseLine.getTime());
        assertThat(range.to.getTime())
            .isEqualTo(addMinutes(baseLine, 15).getTime());

        assertThat(range.entries)
            .hasSize(2);

        assertThat(range.entries[0].timestamp.getTime())
            .isEqualTo(baseLine.getTime());
        assertThat(range.entries[1].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, 10).getTime());

        assertThat(range.totalResults)
            .isNull();

        range = timeSeriesDetails.values.get("Heartrate")[1];

        assertThat(range.from.getTime())
            .isEqualTo(addMinutes(baseLine, 30).getTime());
        assertThat(range.to.getTime())
            .isEqualTo(addMinutes(baseLine, 45).getTime());

        assertThat(range.entries)
            .hasSize(2);
        assertThat(range.entries[0].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, 30).getTime());
        assertThat(range.entries[1].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, 40).getTime());

        assertThat(range.totalResults)
            .isNull();

        assertThat(timeSeriesDetails.values.get("BloodPressure"))
            .hasSize(2);

        range = timeSeriesDetails.values.get("BloodPressure")[0];

        assertThat(range.from.getTime())
            .isEqualTo(baseLine.getTime());
        assertThat(range.to.getTime())
            .isEqualTo(addMinutes(baseLine, 30).getTime());

        assertThat(range.entries)
            .hasSize(4);

        assertThat(range.entries[0].timestamp.getTime())
            .isEqualTo(baseLine.getTime());
        assertThat(range.entries[3].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, 30).getTime());

        assertThat(range.totalResults)
            .isNull();

        range = timeSeriesDetails.values.get("BloodPressure")[1];

        assertThat(range.from.getTime())
            .isEqualTo(addMinutes(baseLine, 60).getTime());
        assertThat(range.to.getTime())
            .isEqualTo(addMinutes(baseLine, 90).getTime());

        assertThat(range.entries)
            .hasSize(4);

        assertThat(range.entries[0].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, 60).getTime());
        assertThat(range.entries[3].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, 90).getTime());

        assertThat(range.totalResults)
            .isNull();

        assertThat(timeSeriesDetails.values.get("Temperature"))
            .hasSize(1);

        range = timeSeriesDetails.values.get("Temperature")[0];

        assertThat(range.from.getTime())
            .isEqualTo(baseLine.getTime());
        assertThat(range.to.getTime())
            .isEqualTo(addDays(baseLine, 1).getTime());

        assertThat(range.entries)
            .hasSize(11);

        assertThat(range.entries[0].timestamp.getTime())
            .isEqualTo(baseLine.getTime());
        assertThat(range.entries[10].timestamp.getTime())
            .isEqualTo(addMinutes(baseLine, 100).getTime());

        assertThat(range.totalResults)
            .isEqualTo(11); // full range
    });

    it("shouldThrowOnNullOrEmptyRanges", async () => {
        const documentId = "users/ayende";

        {
            const session = store.openSession();
            await session.store(new User(), documentId);
            await session.saveChanges();
        }

        const baseLine = testContext.utcToday();

        const timeSeriesOp = new TimeSeriesOperation("Heartrate");

        for (let i = 0; i <= 10; i++) {
            timeSeriesOp.append(
                new AppendOperation(
                    addMinutes(baseLine, i * 10), [ 72 ], "watches/fitbit"));
        }

        const timeSeriesBatch = new TimeSeriesBatchOperation(documentId, timeSeriesOp);

        await store.operations.send(timeSeriesBatch);

        await assertThrows(() => store.operations.send(new GetTimeSeriesOperation("users/ayende", null)), err => {
            assertThat(err.name)
                .isEqualTo("InvalidArgumentException");
        });

        await assertThrows(() => store.operations.send(new GetMultipleTimeSeriesOperation("users/ayende", [])), err => {
            assertThat(err.name)
                .isEqualTo("InvalidArgumentException");
        });
    });

    it("getMultipleTimeSeriesShouldThrowOnMissingNameFromRange", async () => {
        {
            const documentId = "users/ayende";

            {
                const session = store.openSession();
                await session.store(new User(), documentId);
                await session.saveChanges();
            }

            const baseLine = testContext.utcToday();

            const timeSeriesOp = new TimeSeriesOperation("Heartrate");

            for (let i = 0; i <= 10; i++) {
                timeSeriesOp.append(
                    new AppendOperation(addMinutes(baseLine, i * 10), [ 72 ], "watches/fitbit"));
            }

            const timeSeriesBatch = new TimeSeriesBatchOperation(documentId, timeSeriesOp);

            await store.operations.send(timeSeriesBatch);

            await assertThrows(() => {
                return store.operations.send(new GetMultipleTimeSeriesOperation("users/ayende", [{
                    name: null,
                    from: baseLine,
                    to: null
                }]))
            }, err => {
                assertThat(err.name)
                    .isEqualTo("InvalidArgumentException");
                assertThat(err.message)
                    .contains("Name cannot be null or empty");
            })
        }
    });

    it("getTimeSeriesShouldThrowOnMissingName", async () => {
        const documentId = "users/ayende";

        {
            const session = store.openSession();
            await session.store(new User(), documentId);
            await session.saveChanges();
        }

        const baseLine = testContext.utcToday();

        const timeSeriesOp = new TimeSeriesOperation("Heartrate");

        for (let i = 0; i <= 10; i++) {
            timeSeriesOp.append(
                new AppendOperation(
                    addMinutes(baseLine, i * 10), [ 72 ], "watches/fitbit"));
        }

        const timeSeriesBatch = new TimeSeriesBatchOperation(documentId, timeSeriesOp);

        await store.operations.send(timeSeriesBatch);

        await assertThrows(
            () => store.operations.send(
                new GetTimeSeriesOperation(
                    "users/ayende",
                    "",
                    baseLine,
                    addYears(baseLine, 10)))
        , err => {
                assertThat(err.message)
                    .contains("Timeseries cannot be null or empty");
            });
    });

    it("getTimeSeriesStatistics", async () => {
        const documentId = "users/ayende";

        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            await session.store(user, documentId);

            let ts = session.timeSeriesFor(documentId, "heartrate");
            for (let i = 0; i <= 10; i++) {
                ts.append(addMinutes(baseLine, i * 10), 72, "watches/fitbit");
            }

            ts = session.timeSeriesFor(documentId, "pressure");
            for (let i = 10; i <= 20; i++) {
                ts.append(addMinutes(baseLine, i * 10), 72, "watches/fitbit");
            }

            await session.saveChanges();
        }

        const op = await store.operations.send(new GetTimeSeriesStatisticsOperation(documentId));

        assertThat(op.documentId)
            .isEqualTo(documentId);
        assertThat(op.timeSeries)
            .hasSize(2);

        const ts1 = op.timeSeries[0];
        const ts2 = op.timeSeries[1];

        assertThat(ts1.name)
            .isEqualTo("heartrate");
        assertThat(ts2.name)
            .isEqualTo("pressure");

        assertThat(ts1.numberOfEntries)
            .isEqualTo(11);
        assertThat(ts2.numberOfEntries)
            .isEqualTo(11);

        assertThat(ts1.startDate.getTime())
            .isEqualTo(baseLine.getTime());
        assertThat(ts1.endDate.getTime())
            .isEqualTo(addMinutes(baseLine, 10 * 10).getTime());

        assertThat(ts2.startDate.getTime())
            .isEqualTo(addMinutes(baseLine, 10 * 10).getTime());
        assertThat(ts2.endDate.getTime())
            .isEqualTo(addMinutes(baseLine, 20 * 10).getTime());
    });

    it("canDeleteWithoutProvidingFromAndToDates", async () => {
        const baseLine = testContext.utcToday();

        const docId = "users/ayende";

        {
            const session = store.openSession();
            await session.store(new User(), docId);

            const tsf = session.timeSeriesFor(docId, "HeartRate");
            const tsf2 = session.timeSeriesFor(docId, "BloodPressure");
            const tsf3 = session.timeSeriesFor(docId, "BodyTemperature");

            for (let j = 0; j < 100; j++) {
                tsf.append(addMinutes(baseLine, j), j);
                tsf2.append(addMinutes(baseLine, j), j);
                tsf3.append(addMinutes(baseLine, j), j);
            }

            await session.saveChanges();
        }

        let get = await store.operations.send(new GetTimeSeriesOperation(docId, "HeartRAte"));

        assertThat(get.entries)
            .hasSize(100);

        // null From, To

        let deleteOp = new TimeSeriesOperation();
        deleteOp.name = "Heartrate";
        deleteOp.delete(new DeleteOperation());

        await store.operations.send(new TimeSeriesBatchOperation(docId, deleteOp));

        get = await store.operations.send(new GetTimeSeriesOperation(docId, "HeartRate"));
        assertThat(get)
            .isNull();

        get = await store.operations.send(new GetTimeSeriesOperation(docId, "BloodPressure"));
        assertThat(get.entries)
            .hasSize(100);

        // null to

        deleteOp = new TimeSeriesOperation();
        deleteOp.name = "BloodPressure";
        deleteOp.delete(new DeleteOperation(addMinutes(baseLine, 50), null));

        await store.operations.send(new TimeSeriesBatchOperation(docId, deleteOp));

        get = await store.operations.send(new GetTimeSeriesOperation(docId, "BloodPressure"));

        assertThat(get.entries)
            .hasSize(50);

        get = await store.operations.send(new GetTimeSeriesOperation(docId, "BodyTemperature"));
        assertThat(get.entries)
            .hasSize(100);

        // null from
        deleteOp = new TimeSeriesOperation();
        deleteOp.name = "BodyTemperature";
        deleteOp.delete(new DeleteOperation(null, addMinutes(baseLine, 19)));

        await store.operations.send(new TimeSeriesBatchOperation(docId, deleteOp));

        get = await store.operations.send(new GetTimeSeriesOperation(docId, "BodyTemperature"));
        assertThat(get.entries)
            .hasSize(80);
    });
});
