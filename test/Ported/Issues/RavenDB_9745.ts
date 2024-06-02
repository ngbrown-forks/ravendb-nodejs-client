import { Company } from "../../Assets/Entities.js";
import { assertThat } from "../../Utils/AssertExtensions.js";
import { testContext, disposeTestDocumentStore } from "../../Utils/TestUtil.js";

import {
    IDocumentStore,
} from "../../../src/index.js";
import { Explanations } from "../../../src/Documents/Queries/Explanation/Explanations.js";
import { ExplanationOptions } from "../../../src/Documents/Queries/Explanation/ExplanationOptions.js";
import { AbstractJavaScriptIndexCreationTask } from "../../../src/Documents/Indexes/AbstractJavaScriptIndexCreationTask.js";

class CompaniesByNameIndexResult {
    public key: string;
    public count: number;
}

export class CompaniesByNameIndex extends AbstractJavaScriptIndexCreationTask<Company, { key: string, count: number }> {

    public constructor() {
        super();

        this.map(Company, c => {
            return {
                key: c.name,
                count: 1
            }
        });

        this.reduce(result => result.groupBy(r => r.key).aggregate(g => {
            return {
                key: g.key,
                count: g.values.reduce((a, b) => a + b.count, 0)
            }
        }));

        this.store("key", "Yes");
    }
}

describe("RavenDB-9745", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () => 
        await disposeTestDocumentStore(store));

    it("explain", async () => {
        const index = new CompaniesByNameIndex();
        await index.execute(store);

        {
            const session = store.openSession();
            await session.store(Object.assign(new Company(), { name: "Micro" }));
            await session.store(Object.assign(new Company(), { name: "Microsoft" }));
            await session.store(Object.assign(new Company(), { name: "Google" }));
            await session.saveChanges();
        }

        await testContext.waitForIndexing(store);

        {
            const session = store.openSession();
            let explanations: Explanations;
            const companies = await session
                .advanced
                .documentQuery<Company>({ collection: "companies" })
                .includeExplanations(e => explanations = e)
                .search("name", "Micro*")
                .all();

            assertThat(companies)
                .hasSize(2);

            let exp = explanations.explanations[companies[0].id];
            assertThat(exp)
                .isNotNull();

            exp = explanations.explanations[companies[1].id];
            assertThat(exp)
                .isNotNull();
        }

        {
            const session = store.openSession();
            const explOptions = { groupKey: "key" } as ExplanationOptions;
            let explanationsResult;

            const results = await session.advanced
                .documentQuery({ index: CompaniesByNameIndex })
                .includeExplanations(explOptions, e => explanationsResult = e)
                .selectFields<CompaniesByNameIndexResult>([ "key", "count" ])
                .all();

            assertThat(results)
                .hasSize(3);

            let exp = explanationsResult.explanations[results[0].key];
            assertThat(exp)
                .isNotNull();

            exp = explanationsResult.explanations[results[1].key];
            assertThat(exp)
                .isNotNull();

            exp = explanationsResult.explanations[results[2].key];
            assertThat(exp)
                .isNotNull();
        }
    });
});
