import {
    IDocumentStore,
    CONSTANTS,
    RefreshConfiguration,
    ConfigureRefreshOperation
} from "../../../src/index.js";
import { disposeTestDocumentStore, RavenTestContext, testContext } from "../../Utils/TestUtil.js";
import { User } from "../../Assets/Entities.js";
import moment from "moment";
import { Stopwatch } from "../../../src/Utility/Stopwatch.js";
import { throwError } from "../../../src/Exceptions/index.js";
import { assertThat } from "../../Utils/AssertExtensions.js";
import { delay } from "../../../src/Utility/PromiseUtil.js";
import { DateUtil } from "../../../src/Utility/DateUtil.js";

(RavenTestContext.isPullRequest ? describe.skip : describe)("RavenDB_13735", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("refreshWillUpdateDocumentChangeVector", async () => {
        await setupRefresh(store);

        let expectedChangeVector: string;
        {
            const session = store.openSession();
            const user = Object.assign(new User(), {
                name: "Oren"
            });

            await session.store(user, "users/1-A");

            const hourAgo = moment().add(-1, "hour");

            session.advanced.getMetadataFor(user)[CONSTANTS.Documents.Metadata.REFRESH] = DateUtil.utc.stringify(hourAgo.toDate());

            await session.saveChanges();

            expectedChangeVector = session.advanced.getChangeVectorFor(user);
        }

        const sw = Stopwatch.createStarted();

        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (sw.elapsed > 10_000) {
                throwError("TimeoutException");
            }

            {
                const session = store.openSession();
                const user = await session.load<User>("users/1-A", User);
                assertThat(user)
                    .isNotNull();

                if (session.advanced.getChangeVectorFor(user) !== expectedChangeVector) {
                    // change vector was changed - great!
                    break;
                }
            }

            await delay(200);
        }
    });

});

async function setupRefresh(store: IDocumentStore) {
    const config: RefreshConfiguration = {
        disabled: false,
        refreshFrequencyInSec: 1
    };

    return await store.maintenance.send(new ConfigureRefreshOperation(config));
}
