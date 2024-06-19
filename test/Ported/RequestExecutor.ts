import {
    DocumentStore,
    EntityToJson,
    IDocumentStore,
    PutDocumentCommand
} from "../../src/index.js";
import { ClusterTestContext, disposeTestDocumentStore, RavenTestContext, testContext } from "../Utils/TestUtil.js";
import { throwError } from "../../src/Exceptions/index.js";
import { HttpRequestParameters, HttpResponse } from "../../src/Primitives/Http.js";
import { Readable } from "node:stream";
import { User } from "../Assets/Entities.js";
import { assertThat } from "../Utils/AssertExtensions.js";
import { Agent } from "undici";

(RavenTestContext.isPullRequest ? describe.skip : describe)("RequestExecutor", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("onBeforeAfterAndFailRequest1", async () => {
        await onBeforeAfterAndFailRequestInternal(0, 1, ["OnBeforeRequest", "OnAfterRequests"]);
    });

    it("onBeforeAfterAndFailRequest2", async () => {
        await onBeforeAfterAndFailRequestInternal(1, 2, ["OnBeforeRequest", "OnFailedRequest", "OnBeforeRequest", "OnAfterRequests"]);
    });

    it("onBeforeAfterAndFailRequest3", async () => {
        await onBeforeAfterAndFailRequestInternal(2, 2, ["OnBeforeRequest", "OnFailedRequest", "OnBeforeRequest"]);
    });
});

async function onBeforeAfterAndFailRequestInternal(failCount: number, clusterSize: number, expected: string[]) {
    const actual: string[] = [];
    const sessionActual: string[] = [];

    const urlRegex = /databases\/[^/]+\/docs/;

    const context = new ClusterTestContext();
    try {
        const cluster = await context.createRaftCluster(clusterSize);
        try {
            const databaseName = context.getDatabaseName();
            const leader = cluster.getInitialLeader();

            await cluster.createDatabase(databaseName, clusterSize, leader.url);

            const store = new DocumentStore(leader.url, databaseName);
            try {
                store.addSessionListener("beforeRequest", e => {
                    if (!urlRegex.test(e.url)) {
                        return;
                    }
                    sessionActual.push("OnBeforeRequest");
                });

                store.addSessionListener("succeedRequest", e => {
                    if (!urlRegex.test(e.url)) {
                        return;
                    }
                    sessionActual.push("OnAfterRequests");
                });

                store.addSessionListener("failedRequest", e => {
                    if (!urlRegex.test(e.url)) {
                        return;
                    }
                    sessionActual.push("OnFailedRequest");
                });

                store.initialize();

                const requestExecutor = store.getRequestExecutor();

                requestExecutor.on("beforeRequest", e => {
                    if (!urlRegex.test(e.url)) {
                        return;
                    }
                    actual.push("OnBeforeRequest");
                });

                requestExecutor.on("succeedRequest", e => {
                    if (!urlRegex.test(e.url)) {
                        return;
                    }
                    actual.push("OnAfterRequests");
                });

                requestExecutor.on("failedRequest", e => {
                    if (!urlRegex.test(e.url)) {
                        return;
                    }
                    actual.push("OnFailedRequest");
                });

                const documentJson = EntityToJson.convertEntityToJson(new User(), store.conventions);
                const command = new FirstFailCommand("User/1", null, documentJson, failCount);
                try {
                    await requestExecutor.execute(command);
                } catch {
                    // ignored
                }

                assertThat(actual)
                    .isNotEqualTo(expected);
                assertThat(sessionActual)
                    .isNotEqualTo(expected);
            } finally {
                store.dispose();
            }
        } finally {
            cluster.dispose();
        }
    } finally {
        context.dispose();
    }
}

class FirstFailCommand extends PutDocumentCommand {
    private _timeToFail: number;

    public constructor(id: string, changeVector: string, document: object, timeToFail: number) {
        super(id, changeVector, document);

        this._timeToFail = timeToFail;
    }

    send(agent: Agent, requestOptions: HttpRequestParameters): Promise<{ response: HttpResponse; bodyStream: Readable }> {
        this._timeToFail--;
        if (this._timeToFail < 0) {
            return super.send(agent, requestOptions);
        }

        throwError("BadRequestException", "Just testing");
    }
}