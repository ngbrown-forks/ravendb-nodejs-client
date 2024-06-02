import { IDocumentStore, QueryStatistics } from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { Employee } from "../../Assets/Entities.js";
import { assertThat } from "../../Utils/AssertExtensions.js";


describe("RavenDB_21264Test", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("shouldSetSkipStatisticsAccordingly", async function () {
        {
            const session = store.openSession();
            const indexQuery = session.advanced.documentQuery(Employee)
                .whereStartsWith("firstName", "bob")
                .orderBy("birthday")
                .getIndexQuery();

            assertThat(indexQuery.skipStatistics)
                .isTrue();
        }

        {
            const session = store.openSession();
            let stats: QueryStatistics;
            const indexQuery = session.advanced.documentQuery(Employee)
                .statistics(s => stats = s)
                .whereStartsWith("firstName", "bob")
                .orderBy("birthday")
                .getIndexQuery();

            assertThat(indexQuery.skipStatistics)
                .isFalse();
        }
    });
});