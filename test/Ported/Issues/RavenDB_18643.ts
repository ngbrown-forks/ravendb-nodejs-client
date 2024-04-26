import { BulkInsertOnProgressEventArgs, IDocumentStore } from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { assertThat } from "../../Utils/AssertExtensions.js";
import { delay } from "../../../src/Utility/PromiseUtil.js";


describe("RavenDB_18643Test", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canGetProgressOfBulkInsert", async () => {
        const lastInsertedDocId: string[] = [];

        {
            const bulkInsert = store.bulkInsert();

            try {
                bulkInsert.on("progress", (event: BulkInsertOnProgressEventArgs) => {
                    lastInsertedDocId.push(event.progress.lastProcessedId);
                    assertThat(event.progress.lastProcessedId)
                        .isNotNull();
                });

                let i = 0;

                while (lastInsertedDocId.length === 0) {
                    const exampleItem = new ExampleItem();
                    exampleItem.name = "ExampleItem/" + i++;
                    await bulkInsert.store(exampleItem);
                    await delay(200);
                }
            } finally {
                await bulkInsert.finish();
            }

            assertThat(lastInsertedDocId)
                .isNotNull();
        }
    });
});

class ExampleItem {
    name: string;
}
