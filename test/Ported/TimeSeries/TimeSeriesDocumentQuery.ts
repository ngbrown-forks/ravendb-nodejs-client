import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import {
    IDocumentStore,
    TimeSeriesAggregationResult,
    TimeSeriesRawResult
} from "../../../src/index.js";
import { User } from "../../Assets/Entities.js";
import { assertThat } from "../../Utils/AssertExtensions.js";

describe("TimeSeriesDocumentQuery", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canQueryTimeSeriesUsingDocumentQuery", async () => {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren"
            user.age = 35;

            await session.store(user, "users/ayende");

            const tsf = session.timeSeriesFor("users/ayende", "Heartrate");

            tsf.append(baseLine.clone().add(61, "minutes").toDate(), 59, "watches/fitbit");
            tsf.append(baseLine.clone().add(62, "minutes").toDate(), 79, "watches/apple");
            tsf.append(baseLine.clone().add(63, "minutes").toDate(), 69, "watches/fitbit");

            tsf.append(baseLine.clone().add(61, "minutes").add(1, "month").toDate(),
                159,
                "watches/apple");
            tsf.append(baseLine.clone().add(62, "minutes").add(1, "month").toDate(),
                179,
                "watches/apple");
            tsf.append(baseLine.clone().add(63, "minutes").add(1, "month").toDate(),
                169,
                "watches/fitbit");

            await session.saveChanges();
        }

        {
            const session = store.openSession();

            const tsQueryText = "from Heartrate between $start and $end\n" +
                "where Tag = 'watches/fitbit'\n" +
                "group by '1 month'\n" +
                "select min(), max(), avg()";

            const result = await session.query(User)
                .whereGreaterThan("age", 21)
                .selectTimeSeries(b => b.raw(tsQueryText), TimeSeriesAggregationResult)
                .addParameter("start", baseLine.toDate())
                .addParameter("end", baseLine.clone().add(3, "months").toDate())
                .all();

            assertThat(result)
                .hasSize(1);
            assertThat(result[0] instanceof TimeSeriesAggregationResult)
                .isTrue();
            assertThat(result[0].count)
                .isEqualTo(3);

            const agg = result[0].results;
            assertThat(agg)
                .hasSize(2);

            assertThat(agg[0].from instanceof Date)
                .isTrue();
            assertThat(agg[0].to instanceof Date)
                .isTrue();

            assertThat(agg[0].max[0])
                .isEqualTo(69);
            assertThat(agg[0].min[0])
                .isEqualTo(59);
            assertThat(agg[0].average[0])
                .isEqualTo(64);

            assertThat(agg[1].max[0])
                .isEqualTo(169);
            assertThat(agg[1].min[0])
                .isEqualTo(169);
            assertThat(agg[1].average[0])
                .isEqualTo(169);
        }
    });

    it("canQueryTimeSeriesRawValuesUsingDocumentQuery", async () => {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Oren";
            user.age = 35;

            await session.store(user, "users/ayende");

            const tsf = session.timeSeriesFor("users/ayende", "Heartrate");
            tsf.append(baseLine.clone().add(61, "minutes").toDate(), 59, "watches/fitbit");
            tsf.append(baseLine.clone().add(62, "minutes").toDate(), 79, "watches/apple");
            tsf.append(baseLine.clone().add(63, "minutes").toDate(), 69, "watches/fitbit");

            tsf.append(baseLine.clone().add(61, "minutes").add(1, "month").toDate(),
                159,
                "watches/apple");
            tsf.append(baseLine.clone().add(62, "minutes").add(1, "month").toDate(),
                179,
                "watches/apple");
            tsf.append(baseLine.clone().add(63, "minutes").add(1, "month").toDate(),
                169,
                "watches/fitbit");

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const tsQueryText = "from Heartrate between $start and $end\n" +
               "where Tag = 'watches/fitbit'";

            const result = await session.query(User)
                .whereGreaterThan("age", 21)
                .selectTimeSeries(b => b.raw(tsQueryText), TimeSeriesRawResult)
                .addParameter("start", baseLine.toDate())
                .addParameter("end", baseLine.clone().add(3, "months").toDate())
                .all();

            assertThat(result)
                .hasSize(1);
            assertThat(result[0] instanceof TimeSeriesRawResult)
                .isTrue();
            assertThat(result[0].count)
                .isEqualTo(3);

            const values = result[0].results;

            assertThat(values)
                .hasSize(3);

            assertThat(values[0].values[0])
                .isEqualTo(59);
            assertThat(values[0].tag)
                .isEqualTo("watches/fitbit");
            assertThat(values[0].timestamp.getTime())
                .isEqualTo(baseLine.clone().add(61, "minutes").toDate().getTime());

            assertThat(values[1].values[0])
                .isEqualTo(69);
            assertThat(values[1].tag)
                .isEqualTo("watches/fitbit");
            assertThat(values[1].timestamp.getTime())
                .isEqualTo(baseLine.clone().add(63, "minutes").toDate().getTime());

            assertThat(values[2].values[0])
                .isEqualTo(169);
            assertThat(values[2].tag)
                .isEqualTo("watches/fitbit");
            assertThat(values[2].timestamp.getTime())
                .isEqualTo(baseLine.clone().add(63, "minutes").add(1, "month").toDate().getTime());
        }
    });

    //TODO: use serializer from conventions for query parameters - not raw json.stringify!
});