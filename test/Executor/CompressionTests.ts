import sinon from "sinon";
import { testContext, disposeTestDocumentStore } from "../Utils/TestUtil.js";

import DocumentStore, {
    IDocumentStore,
    GetDatabaseNamesCommand,
} from "../../src/index.js";
import { assertThat } from "../Utils/AssertExtensions.js";

describe("Compression", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("is active by default", async () => {
        const exec = store.getRequestExecutor();
        const cmd = new GetDatabaseNamesCommand(0, 5);
        const createReqSpy = exec["_createRequest"] = sinon.spy(exec["_createRequest"]);

        await exec.execute(cmd);
        const reqParams = createReqSpy.lastCall.returnValue;
        assertThat(reqParams.headers["Accept-Encoding"])
            .isNull();
    });

    it("can be turned on on demand", async () => {
        const store2 = new DocumentStore(store.urls, store.database);
        try {
            store2.conventions.useHttpDecompression = true;
            store2.initialize();

            const exec = store2.getRequestExecutor();
            const cmd = new GetDatabaseNamesCommand(0, 5);
            const createReqSpy = exec["_createRequest"] = sinon.spy(exec["_createRequest"]);

            await exec.execute(cmd);
            const reqParams = createReqSpy.lastCall.returnValue;
            assertThat(reqParams.headers["Accept-Encoding"])
                .isNull();
        } finally {
            if (store2) {
                store2.dispose();
            }
        }
    });

    it("can be turned off on demand", async () => {
        const store2 = new DocumentStore(store.urls, store.database);
        try {
            store2.conventions.useHttpDecompression = false;
            store2.initialize();

            const exec = store2.getRequestExecutor();
            const cmd = new GetDatabaseNamesCommand(0, 5);
            const createReqSpy = exec["_createRequest"] = sinon.spy(exec["_createRequest"]);

            await exec.execute(cmd);
            const reqParams = createReqSpy.lastCall.returnValue;
            assertThat(reqParams.headers["Accept-Encoding"])
                .isEqualTo("identity");
        } finally {
            if (store2) {
                store2.dispose();
            }
        }
    });
});
