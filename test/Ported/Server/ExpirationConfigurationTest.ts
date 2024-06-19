import { disposeTestDocumentStore, RavenTestContext, testContext } from "../../Utils/TestUtil.js";
import { assertThat } from "../../Utils/AssertExtensions.js";
import {
    ConfigureExpirationOperation,
    IDocumentStore,
    ExpirationConfiguration
} from "../../../src/index.js";

(RavenTestContext.isPullRequest ? describe.skip : describe)("ExpirationConfigurationTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canSetupExpiration", async () => {
        const expirationConfiguration: ExpirationConfiguration = {
            deleteFrequencyInSec: 5,
            disabled: false
        };

        const configureExpirationOperation = new ConfigureExpirationOperation(expirationConfiguration);

        const expirationOperationResult = await store.maintenance.send(configureExpirationOperation);
        assertThat(expirationOperationResult.raftCommandIndex)
            .isNotNull();
    });
});
