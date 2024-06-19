import {
    AbstractCsharpIndexCreationTask,
    AbstractCsharpMultiMapIndexCreationTask,
    AbstractRawJavaScriptIndexCreationTask,
    GetIndexOperation,
    GetIndexStatisticsOperation,
    IAbstractIndexCreationTask,
    IndexCreation,
    IDocumentStore
} from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { assertThat } from "../../Utils/AssertExtensions.js";
import { INDEXES } from "../../../src/Constants.js";

describe("RavenDB_21574Test", function () {
    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("setting_Index_SearchEngineType_Should_Work", async function () {
        await validateSearchEngineType(new CompanyIndex(), store);
        await validateSearchEngineType(new CompanyIndex_MultiMap(), store);
        await validateSearchEngineType(new CompanyIndex_JavaScript(), store);
    });
});

async function validateSearchEngineType(index: IAbstractIndexCreationTask, store: IDocumentStore) {
    await IndexCreation.createIndexes([index], store);

    await testContext.waitForIndexing(store);

    const indexDefinition = await store.maintenance.send(new GetIndexOperation(index.getIndexName()));
    const indexStats = await store.maintenance.send(new GetIndexStatisticsOperation(index.getIndexName()));

    assertThat(indexDefinition.configuration[INDEXES.INDEXING_STATIC_SEARCH_ENGINE_TYPE])
        .isEqualTo("Corax");
    assertThat(indexStats.searchEngineType)
        .isEqualTo("Corax");
}

class CompanyIndex extends AbstractCsharpIndexCreationTask {

    constructor() {
        super();
        this.map = "from company in docs.Companies select new { company.name }";
        this.searchEngineType = "Corax";
    }
}

class CompanyIndex_MultiMap extends AbstractCsharpMultiMapIndexCreationTask {

    constructor() {
        super();

        this.addMap("from company in docs.Companies select new { company.name }");
        this.reduce = "from result in results " +
            "group result by result.name " +
            "into g " +
            "select new " +
            "{ " +
            "  name = g.Key " +
            "}";

        this.searchEngineType = "Corax";

    }
}

class CompanyIndex_JavaScript extends AbstractRawJavaScriptIndexCreationTask {
    getIndexName(): string {
        return "Companies/JavaScript";
    }

    constructor() {
        super();

        this.maps = new Set(["map('Companies', function(company) { return { Name: company.Name } });"]);
        this.searchEngineType = "Corax";
    }
}