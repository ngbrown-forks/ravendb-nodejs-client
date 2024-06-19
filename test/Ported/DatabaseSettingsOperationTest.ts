import {
    IDocumentStore,
    ToggleDatabasesStateOperation,
    PutDatabaseSettingsOperation,
    GetDatabaseSettingsOperation,
    DatabaseSettings
} from "../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../Utils/TestUtil.js";
import { assertThat } from "../Utils/AssertExtensions.js";

describe("DatabaseSettingsOperationTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("checkIfConfigurationSettingsIsEmpty", async () => {
        await checkIfOurValuesGotSaved(store, {});
    });

    it("changeSingleSettingKeyOnServer", async () => {
        const settings = {
            "Storage.PrefetchResetThresholdInGb": "10"
        }
        await putConfigurationSettings(store, settings);
        await checkIfOurValuesGotSaved(store, settings);
    });

    it("changeMultipleSettingsKeysOnServer", async () => {
        const settings = {
            "Storage.PrefetchResetThresholdInGb": "10",
            "Storage.TimeToSyncAfterFlushInSec": "35",
            "Tombstones.CleanupIntervalInMin": "10"
        };

        await putConfigurationSettings(store, settings);
        await checkIfOurValuesGotSaved(store, settings);
    })

    async function putConfigurationSettings(store: IDocumentStore, settings: Record<string, string>) {
        await store.maintenance.send(new PutDatabaseSettingsOperation(store.database, settings));
        await store.maintenance.server.send(new ToggleDatabasesStateOperation(store.database, true));
        await store.maintenance.server.send(new ToggleDatabasesStateOperation(store.database, false));
    }

    async function getConfigurationSettings(store: IDocumentStore): Promise<DatabaseSettings> {
        const settings = await store.maintenance.send(new GetDatabaseSettingsOperation(store.database));
        assertThat(settings)
            .isNotNull();
        return settings;
    }

    async function checkIfOurValuesGotSaved(store: IDocumentStore, data: Record<string, string>) {
        const settings = await getConfigurationSettings(store);

        for (const key of Object.keys(data)) {
            const configurationValue = settings.settings[key];
            assertThat(configurationValue)
                .isNotNull();
            assertThat(configurationValue)
                .isEqualTo(data[key]);
        }
    }

});
