import {
    DocumentStore,
    IDocumentStore,
    PutConnectionStringOperation,
    RavenConnectionString,
    AddEtlOperation,
    UpdateEtlOperation,
    ResetEtlOperation,
    RavenEtlConfiguration, Transformation, GetOngoingTaskInfoOperation
} from "../../../../../src/index.js";
import { disposeTestDocumentStore, RavenTestContext, testContext } from "../../../../Utils/TestUtil.js";
import { assertThat } from "../../../../Utils/AssertExtensions.js";
import { User } from "../../../../Assets/Entities.js";
import { ReplicationTestContext } from "../../../../Utils/ReplicationTestContext.js";
import { DeleteOngoingTaskOperation } from "../../../../../src/Documents/Operations/OngoingTasks/DeleteOngoingTaskOperation.js";
import { OngoingTaskRavenEtl } from "../../../../../src/Documents/Operations/OngoingTasks/OngoingTask.js";

(RavenTestContext.isPullRequest ? describe.skip : describe)(
    `${RavenTestContext.isPullRequest ? "[Skipped on PR] " : ""}` +
    "EtlTest", function () {

    let store: IDocumentStore;
    let replication: ReplicationTestContext;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
        replication = new ReplicationTestContext();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canAddEtl", async () => {
        let src: DocumentStore;
        let dst: DocumentStore;

        try {
            src = await testContext.getDocumentStore();
            try {
                dst = await testContext.getDocumentStore();

                await insertDocument(src);

                const result = await createConnectionString(src, dst);

                assertThat(result)
                    .isNotNull();

                const etlConfiguration = Object.assign(new RavenEtlConfiguration(), {
                    connectionStringName: "toDst",
                    disabled: false,
                    name: "etlToDst"
                } as Partial<RavenEtlConfiguration>);

                const transformation: Transformation = {
                    applyToAllDocuments: true,
                    name: "Script #1"
                };

                etlConfiguration.transforms = [ transformation ];

                const operation = new AddEtlOperation(etlConfiguration);

                const etlResult = await src.maintenance.send(operation);

                assertThat(etlResult)
                    .isNotNull();

                assertThat(etlResult.raftCommandIndex)
                    .isGreaterThan(0);

                assertThat(etlResult.taskId)
                    .isGreaterThan(0);

                assertThat(await replication.waitForDocumentToReplicate(dst, "users/1", 10 * 1000, User))
                    .isNotNull();

                const ongoingTask = await src.maintenance.send(new GetOngoingTaskInfoOperation(etlResult.taskId, "RavenEtl")) as OngoingTaskRavenEtl;

                assertThat(ongoingTask)
                    .isNotNull();

                assertThat(ongoingTask.taskId)
                    .isEqualTo(etlResult.taskId);
                assertThat(ongoingTask.taskType)
                    .isEqualTo("RavenEtl");
                assertThat(ongoingTask.responsibleNode)
                    .isNotNull();
                assertThat(ongoingTask.taskState)
                    .isEqualTo("Enabled");
                assertThat(ongoingTask.taskName)
                    .isEqualTo("etlToDst");

                assertThat(ongoingTask.configuration.transforms[0] instanceof Transformation)
                    .isTrue();

                const deleteResult = await src.maintenance.send(
                    new DeleteOngoingTaskOperation(etlResult.taskId, "RavenEtl"));

                assertThat(deleteResult.taskId)
                    .isEqualTo(etlResult.taskId);
            } finally {
                dst.dispose()
            }
        } finally {
            src.dispose();
        }
    });

    it ("canAddEtlWithScript", async () => {
        let src: DocumentStore;
        let dst: DocumentStore;

        try {
            src = await testContext.getDocumentStore();
            try {
                dst = await testContext.getDocumentStore();

                await insertDocument(src);

                const result = await createConnectionString(src, dst);

                assertThat(result)
                    .isNotNull();

                const etlConfiguration = Object.assign(new RavenEtlConfiguration(), {
                    connectionStringName: "toDst",
                    disabled: false,
                    name: "etlToDst"
                } as Partial<RavenEtlConfiguration>);

                const transformation: Transformation = {
                    applyToAllDocuments: false,
                    collections: ["Users"],
                    name: "Script #1",
                    script: "loadToUsers(this);"
                };

                etlConfiguration.transforms = [ transformation ];

                const operation = new AddEtlOperation(etlConfiguration);

                const etlResult = await src.maintenance.send(operation);

                assertThat(etlResult)
                    .isNotNull();

                assertThat(etlResult.raftCommandIndex)
                    .isGreaterThan(0);

                assertThat(etlResult.taskId)
                    .isGreaterThan(0);

                assertThat(await replication.waitForDocumentToReplicate(dst, "users/1", 10 * 1000, User))
                    .isNotNull();

            } finally {
                dst.dispose();
            }
        } finally {
            src.dispose();
        }
    });

    it("canUpdateEtl", async () => {
        let src: DocumentStore;
        let dst: DocumentStore;

        try {
            src = await testContext.getDocumentStore();
            try {
                dst = await testContext.getDocumentStore();

                await insertDocument(src);

                const result = await createConnectionString(src, dst);

                assertThat(result)
                    .isNotNull();

                const etlConfiguration = Object.assign(new RavenEtlConfiguration(), {
                    connectionStringName: "toDst",
                    disabled: false,
                    name: "etlToDst"
                } as Partial<RavenEtlConfiguration>);

                const transformation: Transformation = {
                    applyToAllDocuments: false,
                    collections: ["Users"],
                    name: "Script #1",
                    script: "loadToUsers(this);"
                };

                etlConfiguration.transforms = [ transformation ];

                const operation = new AddEtlOperation(etlConfiguration);

                const etlResult = await src.maintenance.send(operation);

                assertThat(await replication.waitForDocumentToReplicate(dst, "users/1", 10 * 1000, User))
                    .isNotNull();

                // now change ETL configuration

                transformation.collections = ["Cars"];
                transformation.script = "loadToCars(this);";

                const updateResult = await src.maintenance.send(new UpdateEtlOperation(etlResult.taskId, etlConfiguration));

                assertThat(updateResult)
                    .isNotNull();

                assertThat(updateResult.raftCommandIndex)
                    .isGreaterThan(0);
                assertThat(updateResult.taskId)
                    .isGreaterThan(etlResult.taskId);

                // this document shouldn't be replicated via ETL
                {
                    const session = src.openSession();
                    const user1 = Object.assign(new User(), { name: "John" });
                    await session.store(user1, "users/2");
                    await session.saveChanges();
                }

                assertThat(await replication.waitForDocumentToReplicate(dst, "users/2", 4000, User))
                    .isNull();
            } finally {
                dst.dispose();
            }
        } finally {
            src.dispose();
        }
    });

    it("canResetEtlTask", async () => {
        let src: DocumentStore;
        let dst: DocumentStore;

        try {
            src = await testContext.getDocumentStore();
            try {
                dst = await testContext.getDocumentStore();

                await insertDocument(src);

                const result = await createConnectionString(src, dst);

                assertThat(result)
                    .isNotNull();

                const transformation = {
                    applyToAllDocuments: true,
                    name: "Script Q&A"
                } as Transformation;

                const etlConfiguration = Object.assign(new RavenEtlConfiguration(), {
                    connectionStringName: "toDst",
                    disabled: false,
                    name: "etlToDst",
                    transforms: [ transformation ]
                } as Partial<RavenEtlConfiguration>);

                const operation = new AddEtlOperation(etlConfiguration);
                const etlResult = await src.maintenance.send(operation);

                assertThat(etlResult)
                    .isNotNull();

                assertThat(etlResult.raftCommandIndex)
                    .isGreaterThan(0);

                assertThat(etlResult.taskId)
                    .isGreaterThan(0);

                await replication.waitForDocumentToReplicate(dst, "users/1", 10_000, User);

                {
                    const session = dst.openSession();
                    await session.delete("users/1");
                }

                await src.maintenance.send(
                    new ResetEtlOperation("etlToDst", "Script Q&A"));

                // etl was reset - waiting again for users/1 doc
                await replication.waitForDocumentToReplicate(dst, "users/1", 10_000, User);

            } finally {
                dst.dispose();
            }
        } finally {
            src.dispose();
        }
    });
});

function createConnectionString(src: IDocumentStore, dst: IDocumentStore) {
    const toDstLink = new RavenConnectionString();
    toDstLink.database = dst.database;
    toDstLink.topologyDiscoveryUrls = [ ...dst.urls ];
    toDstLink.name = "toDst";

    return src.maintenance.send(new PutConnectionStringOperation(toDstLink));
}

async function insertDocument(src: IDocumentStore) {
    const session = src.openSession();

    const user1 = new User();
    user1.name = "Marcin";
    await session.store(user1, "users/1");
    await session.saveChanges();
}
