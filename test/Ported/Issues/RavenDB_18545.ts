import {
    IDocumentStore
} from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { assertThat } from "../../Utils/AssertExtensions.js";

describe("RavenDB_18545", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("quotationForGroupInAlias", async () => {
        {
            const session = store.openSession();
            const job = new Job();
            job.name = "HR Worker";
            job.group = "HR";

            await session.store(job);

            const jobId = job.id;

            await session.saveChanges();

            const q = await session.query(Job)
                .groupBy("group")
                .selectKey(null, "group")
                .selectCount();

            assertThat(q.toString())
                .contains("as 'group'");

            const l = await q.all();

            assertThat(l.length)
                .isGreaterThan(0);

            assertThat(l[0].group)
                .isEqualTo(job.group);
        }
    });

});


class Job {
    id: string;
    name: string;
    group: string;
}
