import { IDocumentStore } from "../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../Utils/TestUtil.js";

describe("RDBC-543", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("can store object w/o prototype", async () => {
        const session = store.openSession();
        const ravenModel: any = {
            name: "John"
        };

        const nullObj = Object.create(null);

        ravenModel.someProp = nullObj;
        await session.store(ravenModel);
        await session.saveChanges();
    })
});
