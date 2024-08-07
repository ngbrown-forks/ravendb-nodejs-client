import {
    AbstractCsharpTimeSeriesIndexCreationTask,
    AbstractMultiMapTimeSeriesIndexCreationTask, DateUtil,
    IDocumentStore
} from "../../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../../Utils/TestUtil.js";
import { Company } from "../../../Assets/Orders.js";
import { assertThat } from "../../../Utils/AssertExtensions.js";
import { User } from "../../../Assets/Entities.js";

describe("BasicTimeSeriesIndexes_StrongSyntaxTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("basicMapIndex", async () => {
        const now1 = testContext.utcToday();

        {
            const session = store.openSession();
            const company = new Company();
            await session.store(company, "companies/1");
            session.timeSeriesFor(company, "HeartRate")
                .append(now1, 7, "tag");

            await session.saveChanges();
        }

        const timeSeriesIndex = new MyTsIndex();
        const indexDefinition = timeSeriesIndex.createIndexDefinition();

        assertThat(indexDefinition)
            .isNotNull();

        await timeSeriesIndex.execute(store);

        await testContext.waitForIndexing(store);

        {
            const session = store.openSession();
            const results = await session.query(IndexResult, MyTsIndex)
                .all();

            assertThat(results)
                .hasSize(1);

            const result = results[0];

            assertThat(DateUtil.utc.parse(result.date).getTime())
                .isEqualTo(now1.getTime());
            assertThat(result.user)
                .isNotNull();
            assertThat(result.heartBeat)
                .isGreaterThan(0);
        }
    });

    it("basicMultiMapIndex", async () => {
        const now = testContext.utcToday();

        const timeSeriesIndex = new MyMultiMapTsIndex();
        await timeSeriesIndex.execute(store);

        {
            const session = store.openSession();
            const company = new Company();

            await session.store(company);

            session.timeSeriesFor(company, "HeartRate")
                .append(now, 2.5, "tag1");
            session.timeSeriesFor(company, "HeartRate2")
                .append(now, 3.5, "tag");

            const user = new User();
            await session.store(user);
            session.timeSeriesFor(user, "HeartRate")
                .append(now, 4.5, "tag3");

            await session.saveChanges();
        }

        await testContext.waitForIndexing(store);

        {
            const session = store.openSession();
            const results = await session.query(IndexResult, MyMultiMapTsIndex).all();

            assertThat(results)
                .hasSize(3);

            const result = results[0];

            assertThat(DateUtil.utc.parse(result.date).getTime())
                .isEqualTo(now.getTime());
            assertThat(result.user)
                .isNotNull();
            assertThat(result.heartBeat)
                .isGreaterThan(0);
        }
    });
});


class MyTsIndex extends AbstractCsharpTimeSeriesIndexCreationTask {
    public constructor() {
        super();

        this.map = "from ts in timeSeries.Companies.HeartRate " +
            "from entry in ts.Entries " +
            "select new { " +
            "   heartBeat = entry.Values[0], " +
            "   date = entry.Timestamp.Date, " +
            "   user = ts.DocumentId " +
            "}";
    }
}

class MyMultiMapTsIndex extends AbstractMultiMapTimeSeriesIndexCreationTask {
    public constructor() {
        super();

        this._addMap( "from ts in timeSeries.Companies.HeartRate " +
            "from entry in ts.Entries " +
            "select new { " +
            "   heartBeat = entry.Values[0], " +
            "   date = entry.Timestamp.Date, " +
            "   user = ts.DocumentId " +
            "}");

        this._addMap( "from ts in timeSeries.Companies.HeartRate2 " +
            "from entry in ts.Entries " +
            "select new { " +
            "   heartBeat = entry.Values[0], " +
            "   date = entry.Timestamp.Date, " +
            "   user = ts.DocumentId " +
            "}");

        this._addMap( "from ts in timeSeries.Users.HeartRate " +
            "from entry in ts.Entries " +
            "select new { " +
            "   heartBeat = entry.Values[0], " +
            "   date = entry.Timestamp.Date, " +
            "   user = ts.DocumentId " +
            "}");
    }
}

class IndexResult {
    public heartBeat: number;
    public date: string;
    public user: string;
}