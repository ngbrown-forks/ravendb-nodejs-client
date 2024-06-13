import { disposeTestDocumentStore, testContext } from "../../../Utils/TestUtil.js";
import { IDocumentStore, GetBuildNumberOperation } from "../../../../src/index.js";
import { assertThat } from "../../../Utils/AssertExtensions.js";

describe("CanGetBuildNumberTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canGetBuildNumber", async () => {
        const buildNumber = await store.maintenance.server.send(new GetBuildNumberOperation());

        assertThat(buildNumber)
            .isNotNull();
        assertThat(buildNumber.productVersion)
            .isNotNull();
    });

});