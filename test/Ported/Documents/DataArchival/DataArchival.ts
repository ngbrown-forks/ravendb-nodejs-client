
import { GetDatabaseRecordOperation, IDocumentStore, DataArchivalConfiguration, ConfigureDataArchivalOperation } from "../../../../src/index.js";
import { disposeTestDocumentStore, RavenTestContext, testContext } from "../../../Utils/TestUtil.js";
import { assertThat } from "../../../Utils/AssertExtensions.js";

(RavenTestContext.isPullRequest ? describe.skip : describe)("DataArchival", function () {
    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canSetupArchival", async function () {

        const configuration: DataArchivalConfiguration = {
            disabled: true,
            archiveFrequencyInSec: 5
        };

        await store.maintenance.send(new ConfigureDataArchivalOperation(configuration));

        const databaseRecordWithEtag = await store.maintenance.server.send(new GetDatabaseRecordOperation(store.database));

        assertThat(databaseRecordWithEtag.dataArchival)
            .isNotNull();
        assertThat(databaseRecordWithEtag.dataArchival.disabled)
            .isTrue();
        assertThat(databaseRecordWithEtag.dataArchival.archiveFrequencyInSec)
            .isEqualTo(5);
    });
});

