import { IDocumentStore } from "../../../src/index.js";
import { disposeTestDocumentStore, TemporaryDirContext, testContext } from "../../Utils/TestUtil.js";
import path from "node:path";
import { StartTransactionsRecordingOperation } from "../../../src/Documents/Operations/TransactionsRecording/StartTransactionsRecordingOperation.js";
import { StopTransactionsRecordingOperation } from "../../../src/Documents/Operations/TransactionsRecording/StopTransactionsRecordingOperation.js";
import { assertThat } from "../../Utils/AssertExtensions.js";
import fs from "node:fs";
import { CreateSampleDataOperation } from "../../Utils/CreateSampleDataOperation.js";

describe("RecordingTransactionOperationsMergerTest", function () {

    let store: IDocumentStore;
    let temporaryDirContext: TemporaryDirContext;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
        temporaryDirContext = new TemporaryDirContext();
    });

    afterEach(async () => {
        await disposeTestDocumentStore(store);
        temporaryDirContext.dispose();
    });

    // TODO: waiting for RavenDB-15106
    it.skip("canRecordTransactions", async () => {
        const targetFile = path.join(temporaryDirContext.tempDir, "record-tx");

        await store.maintenance.send(new StartTransactionsRecordingOperation(path.resolve(targetFile)));

        try {
            await store.maintenance.send(new CreateSampleDataOperation());
        } finally {
            await store.maintenance.send(new StopTransactionsRecordingOperation());
        }

        assertThat(fs.statSync(targetFile).size)
            .isGreaterThan(0);
    });
});
