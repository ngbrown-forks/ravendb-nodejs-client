
import {
    AddEtlOperation,
    ElasticSearchConnectionString, GetOngoingTaskInfoOperation,
    IDocumentStore,
    PutConnectionStringOperation, Transformation,
    OngoingTaskElasticSearchEtl, ElasticSearchEtlConfiguration
} from "../../../../../src/index.js";
import { disposeTestDocumentStore, RavenTestContext, testContext } from "../../../../Utils/TestUtil.js";
import { assertThat } from "../../../../Utils/AssertExtensions.js";

(RavenTestContext.isPullRequest ? describe.skip : describe)("ElasticSearchTest", () => {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canSetupElasticSearch", async () => {
        const elasticSearchConnectionString: ElasticSearchConnectionString = {
            name: "e1",
            nodes: ["https://127.0.0.1:8080"],
            type: "ElasticSearch",
        };

        await store.maintenance.send(new PutConnectionStringOperation(elasticSearchConnectionString));

        const etlConfiguration = Object.assign(new ElasticSearchEtlConfiguration(), {
            connectionStringName: "e1",
            transforms: [
                {
                    collections: ["Orders"],
                    script: "var userData = { UserId: id(this), Name: this.Name }; loadToTest(userData)",
                    name: "Script #1"
                }
            ],
            etlType: "ElasticSearch",
        });

        const etlResult = await store.maintenance.send(new AddEtlOperation(etlConfiguration));

        const ongoingTask = await store.maintenance.send(new GetOngoingTaskInfoOperation(etlResult.taskId, "ElasticSearchEtl")) as OngoingTaskElasticSearchEtl;

        assertThat(ongoingTask)
            .isNotNull();

        assertThat(ongoingTask.configuration.etlType)
            .isEqualTo("ElasticSearch");
        assertThat(ongoingTask.configuration instanceof ElasticSearchEtlConfiguration)
            .isTrue();
        assertThat(ongoingTask.configuration.transforms)
            .hasSize(1);
        assertThat(ongoingTask.configuration.transforms[0] instanceof Transformation)
            .isTrue();
    });
})
