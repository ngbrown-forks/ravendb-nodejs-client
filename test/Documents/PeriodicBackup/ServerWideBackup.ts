import { IDocumentStore } from "../../../src/Documents/IDocumentStore.js";
import { disposeTestDocumentStore, RavenTestContext, testContext } from "../../Utils/TestUtil.js";
import { ServerWideBackupConfiguration } from "../../../src/ServerWide/Operations/Configuration/ServerWideBackupConfiguration.js";
import { PutServerWideBackupConfigurationOperation } from "../../../src/ServerWide/Operations/Configuration/PutServerWideBackupConfigurationOperation.js";
import { FtpSettings } from "../../../src/Documents/Operations/Backups/FtpSettings.js";
import { AzureSettings } from "../../../src/Documents/Operations/Backups/AzureSettings.js";
import { GetServerWideBackupConfigurationsOperation } from "../../../src/ServerWide/Operations/Configuration/GetServerWideBackupConfigurationsOperation.js";
import { assertThat } from "../../Utils/AssertExtensions.js";
import { GetDatabaseRecordOperation } from "../../../src/ServerWide/Operations/GetDatabaseRecordOperation.js";
import { CreateDatabaseOperation } from "../../../src/ServerWide/Operations/CreateDatabaseOperation.js";
import { DatabaseRecord } from "../../../src/ServerWide/index.js";
import { GetServerWideBackupConfigurationOperation } from "../../../src/ServerWide/Operations/Configuration/GetServerWideBackupConfigurationOperation.js";
import { DeleteServerWideTaskOperation } from "../../../src/ServerWide/Operations/OngoingTasks/DeleteServerWideTaskOperation.js";
import { DeleteDatabasesOperation } from "../../../src/index.js";

(RavenTestContext.isPullRequest ? describe.skip : describe)("ServerWideBackup", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canCrudServerWideBackup", async () => {
        try {
            const putConfiguration: ServerWideBackupConfiguration = {
                disabled: true,
                fullBackupFrequency: "0 2 * * 0",
                incrementalBackupFrequency: "0 2 * * 1",
            };

            await store.maintenance.server.send(new PutServerWideBackupConfigurationOperation(putConfiguration));

            const ftpSettings: FtpSettings = {
                url: "http://url:8080",
                disabled: true
            };

            putConfiguration.ftpSettings = ftpSettings;
            await store.maintenance.server.send(new PutServerWideBackupConfigurationOperation(putConfiguration));

            const azureSettings: AzureSettings = {
                disabled: true,
                accountKey: "test"
            };

            putConfiguration.azureSettings = azureSettings;
            await store.maintenance.server.send(new PutServerWideBackupConfigurationOperation(putConfiguration));

            const serverWideBackups = await store.maintenance.server
                .send(new GetServerWideBackupConfigurationsOperation());

            assertThat(serverWideBackups)
                .hasSize(3);

            let databaseRecord = await store.maintenance.server.send(new GetDatabaseRecordOperation(store.database));
            assertThat(databaseRecord.periodicBackups)
                .hasSize(3);

            // update one of the tasks
            const toUpdate = serverWideBackups[1];
            toUpdate.backupType = "Snapshot";
            await store.maintenance.server.send(new PutServerWideBackupConfigurationOperation(toUpdate));

            databaseRecord = await store.maintenance.server.send(new GetDatabaseRecordOperation(store.database));
            assertThat(databaseRecord.periodicBackups)
                .hasSize(3);

            // new database includes all server-wide backups
            const newDbName = store.database + "-testDatabase";
            const dbRecord: DatabaseRecord = {
                databaseName: newDbName
            };
            try {
                await store.maintenance.server.send(new CreateDatabaseOperation(dbRecord));
                databaseRecord = await store.maintenance.server.send(new GetDatabaseRecordOperation(newDbName));
                assertThat(databaseRecord.periodicBackups)
                    .hasSize(3);

                // get by name

                const backupConfiguration = await store.maintenance.server.send(
                    new GetServerWideBackupConfigurationOperation("Backup w/o destinations"));
                assertThat(backupConfiguration)
                    .isNotNull();
            } finally {
                await store.maintenance.server.send(new DeleteDatabasesOperation({
                    databaseNames: [newDbName],
                    hardDelete: true
                }));
            }

        } finally {
            await cleanupServerWideBackups(store);
        }
    });
});

async function cleanupServerWideBackups(store: IDocumentStore) {
    const backupConfigurations = await store.maintenance.server.send(new GetServerWideBackupConfigurationsOperation());
    const names = backupConfigurations
        .map(x => x.name);

    for (const name of names) {
        await store.maintenance.server.send(new DeleteServerWideTaskOperation(name, "Backup"));
    }

    assertThat(await store.maintenance.server.send(new GetServerWideBackupConfigurationsOperation()))
        .hasSize(0);
}
