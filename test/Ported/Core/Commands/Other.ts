import {
    GetDetailedStatisticsOperation,
    GetStatisticsOperation,
    IDocumentStore,
    PutCompareExchangeValueOperation
} from "../../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../../Utils/TestUtil.js";
import { User } from "../../../Assets/Entities.js";
import { assertThat } from "../../../Utils/AssertExtensions.js";

describe("OtherTest", function () {
    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canGetDatabaseStatistics", async function () {
        {
            const session = store.openSession();
            for (let i = 0; i < 10; i++) {
                const id = "foo/bar/" + i;
                const user = new User();
                user.name = "Original shard";
                await session.store(user, id);
                await session.saveChanges();

                const baseLine = testContext.utcToday();
                const ts = session.timeSeriesFor(id, "HeartRates");
                const cf = session.countersFor(id);
                for (let j = 0; j < 20; j++) {
                    ts.append(baseLine.clone().add(j, "minutes").toDate(), j, "watches/apple");
                    cf.increment("Likes", j);
                }

                await session.saveChanges();
            }
        }

        let databaseStatistics = await store.maintenance.send(new GetStatisticsOperation());
        let detailedDatabaseStatistics = await store.maintenance.send(new GetDetailedStatisticsOperation());

        assertThat(databaseStatistics)
            .isNotNull();
        assertThat(detailedDatabaseStatistics)
            .isNotNull();

        assertThat(databaseStatistics.countOfDocuments)
            .isEqualTo(10);
        assertThat(databaseStatistics.countOfCounterEntries)
            .isEqualTo(10);
        assertThat(databaseStatistics.countOfTimeSeriesSegments)
            .isEqualTo(10);

        assertThat(detailedDatabaseStatistics.countOfDocuments)
            .isEqualTo(10);
        assertThat(detailedDatabaseStatistics.countOfCounterEntries)
            .isEqualTo(10);
        assertThat(detailedDatabaseStatistics.countOfTimeSeriesSegments)
            .isEqualTo(10);

        {
            const session = store.openSession();
            session.timeSeriesFor("foo/bar/0", "HeartRates").delete();
            await session.saveChanges();
        }
        {
            const session = store.openSession();
            await session.delete("foo/bar/0");
            await session.saveChanges();
        }

        await store.operations.send(new PutCompareExchangeValueOperation("users/1", "Raven", 0));

        databaseStatistics = await store.maintenance.send(new GetStatisticsOperation());
        detailedDatabaseStatistics = await store.maintenance.send(new GetDetailedStatisticsOperation());

        assertThat(databaseStatistics.countOfDocuments)
            .isEqualTo(9);
        assertThat(detailedDatabaseStatistics.countOfTombstones)
            .isEqualTo(1);

        assertThat(detailedDatabaseStatistics.countOfDocuments)
            .isEqualTo(9);
        assertThat(detailedDatabaseStatistics.countOfTombstones)
            .isEqualTo(1);
        assertThat(detailedDatabaseStatistics.countOfCompareExchange)
            .isEqualTo(1);
        assertThat(detailedDatabaseStatistics.countOfTimeSeriesDeletedRanges)
            .isEqualTo(1);
    });
})
