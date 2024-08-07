import { disposeTestDocumentStore, RavenTestContext, testContext } from "../../../Utils/TestUtil.js";
import {
    ConfigureExpirationOperation,
    DocumentStore,
    ExpirationConfiguration,
    IDocumentStore,
    PullReplicationAsSink,
    PullReplicationDefinition,
    PutConnectionStringOperation,
    PutPullReplicationAsHubOperation,
    RavenConnectionString,
    UpdatePullReplicationAsSinkOperation,
    ReplicationHubAccess,
    RegisterReplicationHubAccessOperation
} from "../../../../src/index.js";
import { ReplicationTestContext } from "../../../Utils/ReplicationTestContext.js";
import { GenerateCertificateOperation } from "../../../Infrastructure/GenerateCertificateOperation.js";
import { assertThat } from "../../../Utils/AssertExtensions.js";
import { delay } from "../../../../src/Utility/PromiseUtil.js";
import { addMinutes } from "date-fns";

(RavenTestContext.isPullRequest ? describe.skip : describe)("PullReplicationTest", function () {

    let store: IDocumentStore;
    let replication: ReplicationTestContext;

    this.timeout(60_000);

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
        replication = new ReplicationTestContext();
    });

    afterEach(async () => {
        replication = null;
        await disposeTestDocumentStore(store);
    });

    it("preventDeletionsOnHub", async () => {
        const hubStore = await testContext.getSecuredDocumentStore();

        try {
            const sinkStore = await testContext.getSecuredDocumentStore();
            try {
                const certificate = await hubStore.maintenance.send(new GenerateCertificateOperation());

                await setupExpiration(sinkStore);

                const pullReplicationDefinition: PullReplicationDefinition = {
                    name: "pullRepHub",
                    mode: "HubToSink,SinkToHub",
                    preventDeletionsMode: "PreventSinkToHubDeletions"
                };

                await hubStore.maintenance.send(new PutPullReplicationAsHubOperation(pullReplicationDefinition));

                const replicationHubAccess: ReplicationHubAccess = {
                    name: "hubAccess",
                    certificateBase64: certificate.publicKey,
                }

                await hubStore.maintenance.send(new RegisterReplicationHubAccessOperation("pullRepHub", replicationHubAccess));

                const ravenConnectionString: RavenConnectionString = {
                    database: hubStore.database,
                    name: hubStore.database + "ConStr",
                    topologyDiscoveryUrls: hubStore.urls,
                    type: "Raven"
                };

                await sinkStore.maintenance.send(new PutConnectionStringOperation(ravenConnectionString));

                const pullReplicationAsSink: PullReplicationAsSink = {
                    connectionStringName: hubStore.database + "ConStr",
                    certificateWithPrivateKey: certificate.certificate,
                    hubName: "pullRepHub",
                    mode: "HubToSink,SinkToHub"
                };

                await sinkStore.maintenance.send(new UpdatePullReplicationAsSinkOperation(pullReplicationAsSink));

                {
                    const s = sinkStore.openSession();
                    const user1 = new User();
                    user1.source = "Sink";
                    await s.store(user1, "users/insink/1");
                    s.advanced.getMetadataFor(user1)["@expires"] = addMinutes(new Date(), 10).toISOString();

                    const user2 = new User();
                    user2.source = "Sink";
                    await s.store(user2, "users/insink/2");
                    s.advanced.getMetadataFor(user2)["@expires"] = addMinutes(new Date(), 10).toISOString();

                    await s.saveChanges();
                }

                {
                    const s = hubStore.openSession();
                    const u = new User();
                    u.source = "Hub";
                    await s.store(u, "users/inhub/1");
                    await s.saveChanges();
                }

                assertThat(await testContext.waitForDocument(User, sinkStore, "users/inhub/1"))
                    .isTrue();

                //make sure hub got both docs and expires gets deleted

                {
                    const h = hubStore.openSession();
                    // check hub got both docs

                    const doc1 = await h.load("users/insink/1", User);
                    assertThat(doc1)
                        .isNotNull();

                    const doc2 = await h.load("users/insink/2");
                    assertThat(doc2)
                        .isNotNull();

                    //check expired does not exist in users/insink/1
                    let metadata = h.advanced.getMetadataFor(doc1);
                    assertThat("@expires" in metadata)
                        .isFalse();

                    //check expired does not exist in users/insink/2

                    metadata = h.advanced.getMetadataFor(doc2);
                    assertThat("@expires" in metadata)
                        .isFalse();
                }

                // delete doc from sink
                {
                    const s = sinkStore.openSession();
                    await s.delete("users/insink/1");
                    await s.saveChanges();
                }

                await replication.ensureReplicating(hubStore, sinkStore);

                //make sure doc is deleted from sink
                assertThat(await testContext.waitForDocumentDeletion(sinkStore, "users/insink/1"))
                    .isTrue();

                //make sure doc not deleted from hub and still doesn't contain expires
                {
                    const h = hubStore.openSession();

                    // check hub got doc
                    const doc1 = await h.load("users/insink/1", User);
                    assertThat(doc1)
                        .isNotNull();

                    //check expires does not exist in users/insink/1
                    const metadata = h.advanced.getMetadataFor(doc1);
                    assertThat("@expires" in metadata)
                        .isFalse();
                }
            } finally {
                sinkStore.dispose();
            }
        } finally {
            hubStore.dispose();
        }
    });
});


async function setupExpiration(store: DocumentStore) {
    const config: ExpirationConfiguration = {
        disabled: false,
        deleteFrequencyInSec: 2
    };

    await store.maintenance.send(new ConfigureExpirationOperation(config));

    await delay(1_500);
}

class User {
    public id: string;
    public source: string;
}
