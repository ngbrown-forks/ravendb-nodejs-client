import { disposeTestDocumentStore, RavenTestContext, testContext } from "../../../../Utils/TestUtil.js";
import {
    AddEtlOperation, GetOngoingTaskInfoOperation,
    IDocumentStore,
    PutConnectionStringOperation,
    OngoingTaskQueueEtl,
    QueueEtlConfiguration,
    QueueConnectionString, Transformation
} from "../../../../../src/index.js";
import { assertThat } from "../../../../Utils/AssertExtensions.js";

(RavenTestContext.isPullRequest ? describe.skip : describe)("RabbitMqTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canSetupRabbitMq", async () => {
        const connectionString = new QueueConnectionString();
        connectionString.name = "r1";
        connectionString.brokerType = "RabbitMq";
        connectionString.rabbitMqConnectionSettings = {
            connectionString: "r_host"
        }

        await store.maintenance.send(new PutConnectionStringOperation(connectionString));

        const etlConfiguration = new QueueEtlConfiguration();
        etlConfiguration.connectionStringName = "r1";
        etlConfiguration.transforms = [
            {
                collections: ["Orders"],
                script: "var userData = { UserId: id(this), Name: this.Name }; loadToTest(userData)",
                name: "Script #1"
            }
        ];
        etlConfiguration.brokerType = "RabbitMq";

        const etlResult = await store.maintenance.send(new AddEtlOperation(etlConfiguration));

        const ongoingTask = await store.maintenance.send(new GetOngoingTaskInfoOperation(etlResult.taskId, "QueueEtl")) as OngoingTaskQueueEtl;

        assertThat(ongoingTask)
            .isNotNull();
        assertThat(ongoingTask.taskType)
            .isEqualTo("QueueEtl");
        assertThat(ongoingTask.configuration instanceof QueueEtlConfiguration)
            .isTrue();
        assertThat(ongoingTask.configuration.etlType)
            .isEqualTo("Queue");
        assertThat(ongoingTask.configuration.brokerType)
            .isEqualTo("RabbitMq");
        assertThat(ongoingTask.configuration.transforms)
            .hasSize(1);
        assertThat(ongoingTask.configuration.transforms[0] instanceof Transformation)
            .isTrue();
    });
});
