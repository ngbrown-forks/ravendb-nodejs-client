import {
    IDocumentStore,
    PutConnectionStringOperation,
    QueueBrokerType,
    QueueSinkConfiguration,
    QueueConnectionString,
    AddQueueSinkOperation,
    GetOngoingTaskInfoOperation,
    UpdateQueueSinkOperation,
    OngoingTaskQueueSink
} from "../../../../../src/index.js";
import { disposeTestDocumentStore, RavenTestContext, testContext } from "../../../../Utils/TestUtil.js";
import { assertThat } from "../../../../Utils/AssertExtensions.js";

(RavenTestContext.isPullRequest ? describe.skip : describe)("QueueSinkTest", function () {
    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canSetupKafkaSink", async function () {
        const connectionString = new QueueConnectionString();
        connectionString.name = "k1";
        connectionString.brokerType = "Kafka";
        connectionString.kafkaConnectionSettings = {
            bootstrapServers: "localhost:9092",
        }

        await store.maintenance.send(new PutConnectionStringOperation(connectionString));

        await setupQueueSink("Kafka", store, connectionString.name);
    });

    it("canSetupRabbitMqSink", async function () {
        const connectionString = new QueueConnectionString();
        connectionString.name = "k1";
        connectionString.brokerType = "RabbitMq";
        connectionString.rabbitMqConnectionSettings = {
            connectionString: "localhost:9050"
        };

        await store.maintenance.send(new PutConnectionStringOperation(connectionString));

        await setupQueueSink("RabbitMq", store, connectionString.name);
    });
})

async function setupQueueSink(brokerType: QueueBrokerType, store: IDocumentStore, connectionStringName: string) {
    const queueSinkConfiguration: QueueSinkConfiguration = {
        brokerType,
        disabled: true,
        name: "QueueSink",
        connectionStringName,
        scripts: [
            {
                name: "Script #1",
                queues: ["users"],
                script: "this.a = 5",
            }
        ],
    }

    const addResult = await store.maintenance.send(new AddQueueSinkOperation(queueSinkConfiguration));
    assertThat(addResult)
        .isNotNull();

    const taskId = addResult.taskId;

    const sink = (await store.maintenance.send(new GetOngoingTaskInfoOperation(taskId, "QueueSink"))) as OngoingTaskQueueSink;
    assertThat(sink.brokerType)
        .isEqualTo(brokerType);
    assertThat(sink.connectionStringName)
        .isEqualTo(connectionStringName);
    assertThat(sink.taskState)
        .isEqualTo("Disabled");

    sink.configuration.disabled = false;

    const updateResult = await store.maintenance.send(new UpdateQueueSinkOperation(taskId, sink.configuration));
    assertThat(updateResult)
        .isNotNull();
}