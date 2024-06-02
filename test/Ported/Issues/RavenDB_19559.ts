import {
    GetCompareExchangeValueOperation,
    IDocumentStore,
    PutCompareExchangeValueOperation,
    SessionOptions
} from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { assertThat } from "../../Utils/AssertExtensions.js";

describe("RavenDB_19559Test", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it ("can_Use_Arrays_In_CompareExchange", async function () {
        const sessionOptions: SessionOptions = {
            transactionMode: "ClusterWide"
        }
        {
            const session = store.openSession(sessionOptions);
            session.advanced.clusterTransaction.createCompareExchangeValue("key2", ["1", "2", "3"]);
            await session.saveChanges();
        }
        {
            const session = store.openSession(sessionOptions);
            const value = await session.advanced.clusterTransaction.getCompareExchangeValue<string[]>("key2");
            value.value[2] = "4";
            await session.saveChanges();
        }

        {
            const session = store.openSession(sessionOptions);
            const value = await session.advanced.clusterTransaction.getCompareExchangeValue<string>("key2");
            assertThat(value.value)
                .hasSize(3);
            assertThat(value.value)
                .contains("1")
                .contains("2")
                .contains("4");
        }

        {
            const result1 = await store.operations.send(new PutCompareExchangeValueOperation("key1", ["1", "2", "3"], 0));
            assertThat(result1.value)
                .isEqualTo(["1", "2", "3"]);

            const result2 = await store.operations.send(new GetCompareExchangeValueOperation("key1"));
            assertThat(result2.value)
                .isEqualTo(["1", "2", "3"]);
        }
    })
})
