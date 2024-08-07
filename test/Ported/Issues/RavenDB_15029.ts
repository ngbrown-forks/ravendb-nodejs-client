import { IDocumentStore, TimeSeriesRawResult } from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { User } from "../../Assets/Entities.js";
import { assertThat } from "../../Utils/AssertExtensions.js";

describe("RavenDB_15029", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("sessionRawQueryShouldNotTrackTimeSeriesResultAsDocument", async () => {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            const user = new User();
            user.name = "Karmel";
            await session.store(user, "users/karmel");
            session.timeSeriesFor("users/karmel", "HeartRate")
                .append(baseLine, 60, "watches/fitbit");
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const u = await session.load<User>("users/karmel", User);
            const query = session.advanced.rawQuery<TimeSeriesRawResult>(
                "declare timeseries out()\n" +
                "{\n" +
                "    from HeartRate\n" +
                "}\n" +
                "from Users as u\n" +
                "where name = 'Karmel'\n" +
                "select out()", TimeSeriesRawResult);

            const result = await query.first();

            assertThat(result.count)
                .isEqualTo(1);
            assertThat(result.results[0].value)
                .isEqualTo(60);
            assertThat(result.results[0].timestamp.getTime())
                .isEqualTo(baseLine.getTime());
            assertThat(result.results[0].tag)
                .isEqualTo("watches/fitbit");
        }
    });
});
