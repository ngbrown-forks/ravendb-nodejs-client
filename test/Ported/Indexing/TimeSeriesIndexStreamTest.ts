import {
    AbstractCsharpTimeSeriesIndexCreationTask, DateUtil,
    IDocumentStore,
    StreamResult
} from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { Company } from "../../Assets/Orders.js";
import { finishedAsync } from "../../../src/Utility/StreamUtil.js";
import { assertThat } from "../../Utils/AssertExtensions.js";
import { addMinutes } from "date-fns";

describe("TimeSeriesIndexStreamTest", function () {

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

            const ts = session.timeSeriesFor(company, "HeartRate");

            for (let i = 0; i < 10; i++) {
                ts.append(addMinutes(now1, i), i, "tag");
            }

            await session.saveChanges();
        }

        const timeSeriesIndex = new MyTsIndex();
        await timeSeriesIndex.execute(store);

        await testContext.waitForIndexing(store);

        {
            const session = store.openSession();
            let i = 0;

            const queryStream = await session.advanced.stream(session.query(IndexResult, MyTsIndex));

            queryStream.on("data", (item: StreamResult<IndexResult>) => {
                const results = item.document;
                assertThat(item.document instanceof IndexResult)
                    .isTrue();
                assertThat(DateUtil.utc.parse(results.timestamp).getTime())
                    .isEqualTo(addMinutes(now1, i).getTime());
                assertThat(results.heartBeat)
                    .isEqualTo(i);
                assertThat(results.user)
                    .isEqualTo("companies/1");
                i++;
            });

            await finishedAsync(queryStream);

            assertThat(i)
                .isEqualTo(10);
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
            "   timestamp = entry.Timestamp, " +
            "   user = ts.DocumentId " +
            "}";
    }
}

class IndexResult {
    heartBeat: number;
    timestamp: string;
    user: string;
}
