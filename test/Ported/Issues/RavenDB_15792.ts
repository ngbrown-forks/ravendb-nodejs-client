import { IDocumentStore, TimeSeriesRawResult } from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { User } from "../../Assets/Entities.js";
import { assertThat } from "../../Utils/AssertExtensions.js";

describe("RavenDB_15792Test", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canQueryTimeSeriesWithSpacesInName", async () => {
        const documentId = "users/ayende";

        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();

            await session.store(new User(), documentId);

            const tsf = session.timeSeriesFor(documentId, "gas m3 usage");
            tsf.append(baseLine, 1);

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const query = session.advanced.rawQuery(`declare timeseries out()
{
    from "gas m3 usage"
}
from Users as u
select out()`, TimeSeriesRawResult);

            const result = await query.first();

            assertThat(result)
                .isNotNull();

            const results = result.results;
            assertThat(results)
                .hasSize(1);
        }
    });

});
