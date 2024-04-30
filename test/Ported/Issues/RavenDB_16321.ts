import { IDocumentStore } from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { Employee } from "../../Assets/Orders.js";
import { assertThat, assertThrows } from "../../Utils/AssertExtensions.js";
import { finishedAsync } from "../../../src/Utility/StreamUtil.js";

describe("RavenDB_16321Test", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("streamingOnIndexThatDoesNotExistShouldThrow", async () => {
        const session = store.openSession();

        const query = session.query<Employee>({
            indexName: "Does_Not_Exist",
            documentType: Employee
        })
            .whereEquals("firstName", "Robert");

        await assertThrows(async () => {
            const stream = await session.advanced.stream<Employee>(query);

            stream.on("data", () => {
                // empty
            });

            await finishedAsync(stream);
        }, err => {
            assertThat(err.name)
                .isEqualTo("IndexDoesNotExistException");
        })
    });
});