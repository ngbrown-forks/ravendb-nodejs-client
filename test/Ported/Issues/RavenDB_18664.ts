import { IDocumentSession, IDocumentStore } from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { assertThat } from "../../Utils/AssertExtensions.js";

describe("RavenDB_18664", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("givenADocument_WhenAnEmptyListIsPassedToCheckIfIdsExist_QueryShouldReturnZeroResults", async () => {
        {
            const session = store.openSession();
            await createTestDocument(session);
            await session.saveChanges();
        }

        const emptyList: string[] = [];

        {
            const session = store.openSession();
            const queryCount = await session.query(TestDocument)
                .whereIn("id", emptyList)
                .count();

            assertThat(queryCount)
                .isZero();
        }
    });
});

async function createTestDocument(session: IDocumentSession) {
    const testDoc = new TestDocument();
    testDoc.comment = "TestDoc1";

    await session.store(testDoc);
}


class TestDocument {
    id: string;
    comment: string;
}
