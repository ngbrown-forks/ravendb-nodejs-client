import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import {
    IDocumentStore,
    GetEssentialStatisticsOperation
} from "../../../src/index.js";
import { assertThat } from "../../Utils/AssertExtensions.js";
import { Company } from "../../Assets/Entities.js";
import { CompaniesByNameIndex } from "./RavenDB_9745.js";

describe("RavenDB_18648Test", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("can_Get_Essential_Database_Statistics", async () => {
        let stats = await store.maintenance.send(new GetEssentialStatisticsOperation());

        assertThat(stats.countOfAttachments)
            .isZero();
        assertThat(stats.countOfConflicts)
            .isZero();
        assertThat(stats.countOfCounterEntries)
            .isZero();
        assertThat(stats.countOfDocuments)
            .isZero();
        assertThat(stats.countOfDocumentsConflicts)
            .isZero();
        assertThat(stats.countOfIndexes)
            .isZero();
        assertThat(stats.countOfRevisionDocuments)
            .isZero();
        assertThat(stats.countOfTimeSeriesSegments)
            .isZero();
        assertThat(stats.countOfTombstones)
            .isZero();
        assertThat(stats.indexes)
            .hasSize(0);

        {
            const session = store.openSession();
            for (let i = 0; i < 20; i++) {
                const company = new Company();
                await session.store(company);
                session.timeSeriesFor(company, "TS")
                    .append(new Date(), 1);
                session.countersFor(company)
                    .increment("CTS", 1);
                session.advanced.attachments.store(company, "a1", Buffer.from([0]))
            }
            await session.saveChanges();
        }

        const index = new CompaniesByNameIndex();
        await index.execute(store);

        stats = await store.maintenance.send(new GetEssentialStatisticsOperation());

        assertThat(stats.countOfAttachments)
            .isEqualTo(20);
        assertThat(stats.countOfConflicts)
            .isZero();
        assertThat(stats.countOfCounterEntries)
            .isEqualTo(20);
        assertThat(stats.countOfDocuments)
            .isEqualTo(21);
        assertThat(stats.countOfDocumentsConflicts)
            .isZero();
        assertThat(stats.countOfIndexes)
            .isEqualTo(1);
        assertThat(stats.countOfRevisionDocuments)
            .isZero();
        assertThat(stats.countOfTimeSeriesSegments)
            .isEqualTo(20);
        assertThat(stats.countOfTombstones)
            .isZero();
        assertThat(stats.indexes)
            .hasSize(1);

        const indexInformation = stats.indexes[0];
        assertThat(indexInformation.name)
            .isEqualTo(index.getIndexName());
    })
});
