import { IDocumentStore } from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { Product, Supplier } from "../../Assets/Orders.js";
import { assertThat, assertThrows } from "../../Utils/AssertExtensions.js";

describe("RavenDB_21339Test", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("using_Includes_In_Non_Tracking_Session_Should_Throw", async () => {
        {
            const session = store.openSession();
            const supplier = new Supplier();
            supplier.id = "suppliers/1";

            await session.store(supplier);

            const product = new Product();
            product.id = "products/1";
            product.supplier = supplier.id;
            await session.store(product);

            await session.saveChanges();
        }

        {
            const session = store.openSession({
                noTracking: true
            });

            await assertThrows(async () => session.load("products/1", {
                documentType: Product,
                includes: i => i.includeDocuments("supplier")
            }), err => {
                assertThat(err.message)
                    .contains("registering includes is forbidden");
            });

            await assertThrows(async () => session.query(Product)
                .include("supplier").all(), err => {
                assertThat(err.message)
                    .contains("registering includes is forbidden");
            })
        }
    });
});