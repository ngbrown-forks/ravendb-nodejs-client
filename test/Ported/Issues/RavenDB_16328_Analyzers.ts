import {
    AbstractJavaScriptIndexCreationTask,
    IDocumentStore,
    ResetIndexOperation,
    DeleteServerWideAnalyzerOperation,
    PutServerWideAnalyzersOperation,
    AnalyzerDefinition
} from "../../../src/index.js";
import { disposeTestDocumentStore, RavenTestContext, testContext } from "../../Utils/TestUtil.js";
import { assertThat, assertThrows } from "../../Utils/AssertExtensions.js";

(RavenTestContext.isPullRequest ? describe.skip : describe)("RavenDB_16328_AnalyzersTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("canUseCustomAnalyzer", async function () {
        const analyzerName = "MyAnalyzer";

        await assertThrows(() => store.executeIndex(new MyIndex(analyzerName)), err => {
            assertThat(err.name)
                .isEqualTo("IndexCompilationException");
            assertThat(err.message)
                .contains("Cannot find analyzer type '" + analyzerName + "' for field: name");
        });

        const analyzerDefinition: AnalyzerDefinition = {
            name: analyzerName,
            code: RavenDB_16328_Analyzer
        };

        try {
            await store.maintenance.send(new PutServerWideAnalyzersOperation(analyzerDefinition));

            await store.executeIndex(new MyIndex(analyzerName));

            await fill(store);

            await testContext.waitForIndexing(store);

            await assertCount(store);

            await store.maintenance.send(new DeleteServerWideAnalyzerOperation(analyzerName));

            await store.maintenance.send(new ResetIndexOperation(new MyIndex(analyzerName).getIndexName()));

            const errors = await testContext.indexes.waitForIndexingErrors(store, 10_000);
            assertThat(errors)
                .hasSize(1);
            assertThat(errors[0].errors)
                .hasSize(1);
            assertThat(errors[0].errors[0].error)
                .contains("Cannot find analyzer type '" + analyzerName + "' for field: name");
        } finally {
            await store.maintenance.send(new DeleteServerWideAnalyzerOperation(analyzerName));
        }
    });
});

async function fill(store: IDocumentStore) {
    const session = store.openSession();

    const c1 = new Customer();
    c1.name = "Rogério";
    await session.store(c1);

    const c2 = new Customer();
    c2.name = "Rogerio";
    await session.store(c2);

    const c3 = new Customer();
    c3.name = "Paulo Rogerio";
    await session.store(c3);

    const c4 = new Customer();
    c4.name = "Paulo Rogério";
    await session.store(c4);

    const c5 = new Customer();
    c5.name = "Paulo Rogerio Secondado";
    await session.store(c5);

    const c6 = new Customer();
    c6.name = "Paulo Rogério Secondado";
    await session.store(c6);

    await session.saveChanges();
}

async function assertCount(store: IDocumentStore) {
    await testContext.waitForIndexing(store);

    {
        const session = store.openSession();
        const results = session.query(Customer, MyIndex)
            .noCaching()
            .search("name", "Rogério*");

        assertThat(await results.count())
            .isEqualTo(6);
    }
}


class Customer {
    public id: string;
    public name: string;
}

class MyIndex extends AbstractJavaScriptIndexCreationTask<Customer> {
    constructor(analyzerName = "MyAnalyzer") {
        super();

        this.map(Customer, c => ({
            name: c.name
        }));

        this.index("name", "Search");
        this.analyze("name", analyzerName);
    }
}


export const RavenDB_16328_Analyzer = "using System.IO;\n" +
    "using Lucene.Net.Analysis;\n" +
    "using Lucene.Net.Analysis.Standard;\n" +
    "\n" +
    "namespace SlowTests.Data.RavenDB_14939\n" +
    "{\n" +
    "    public class MyAnalyzer : StandardAnalyzer\n" +
    "    {\n" +
    "        public MyAnalyzer()\n" +
    "            : base(Lucene.Net.Util.Version.LUCENE_30)\n" +
    "        {\n" +
    "        }\n" +
    "\n" +
    "        public override TokenStream TokenStream(string fieldName, TextReader reader)\n" +
    "        {\n" +
    "            return new ASCIIFoldingFilter(base.TokenStream(fieldName, reader));\n" +
    "        }\n" +
    "    }\n" +
    "}\n";
