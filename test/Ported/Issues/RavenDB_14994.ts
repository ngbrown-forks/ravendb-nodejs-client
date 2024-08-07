import { GetTimeSeriesOperation, IDocumentStore } from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { User } from "../../Assets/Entities.js";
import { assertThat } from "../../Utils/AssertExtensions.js";
import { addMinutes } from "date-fns";

describe("RavenDB_14994", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("getOnNonExistingTimeSeriesShouldReturnNull", async () => {
        const documentId = "users/ayende";

        {
            const session = store.openSession();
            await session.store(new User(), documentId);
            await session.saveChanges();
        }

        const get = await store.operations.send(new GetTimeSeriesOperation(documentId, "HeartRate"));
        assertThat(get)
            .isNull();

        {
            const session = store.openSession();
            assertThat(await session.timeSeriesFor(documentId, "HeartRate").get())
                .isNull();
        }
    });

    it("getOnEmptyRangeShouldReturnEmptyArray", async () => {
        const documentId = "users/ayende";

        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            await session.store(new User(), documentId);

            const tsf = session.timeSeriesFor(documentId, "HeartRate");
            for (let i = 0; i < 10; i++) {
                tsf.append(addMinutes(baseLine, i), i);
            }

            await session.saveChanges();
        }

        const get = await store.operations.send(
            new GetTimeSeriesOperation(
                documentId,
                "HeartRate",
                addMinutes(baseLine, -2),
                addMinutes(baseLine, -1)));

        assertThat(get.entries)
            .hasSize(0);

        {
            const session = store.openSession();
            const result = await session.timeSeriesFor(documentId, "HeartRate")
                .get(addMinutes(baseLine, -2), addMinutes(baseLine, -1));
            assertThat(result)
                .hasSize(0);
        }
    });
});
