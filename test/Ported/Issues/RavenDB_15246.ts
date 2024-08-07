import {
    IDocumentStore,
    GetMultipleTimeSeriesCommand,
    TimeSeriesRange
} from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { User } from "../../Assets/Entities.js";
import { assertThat } from "../../Utils/AssertExtensions.js";
import { TypeUtil } from "../../../src/Utility/TypeUtil.js";
import { addMinutes } from "date-fns";

describe("RavenDB_15426", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("testClientCacheWithPageSize", async () => {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            await session.store(new User(), "users/1-A");
            const tsf = session.timeSeriesFor("users/1-A", "Heartrate");
            for (let i = 0; i <= 20; i++) {
                tsf.append(addMinutes(baseLine, i), [ i ], "watches/apple");
            }

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const user = await session.load<User>("users/1-A", User);
            const ts = session.timeSeriesFor(user, "Heartrate");
            let res = await ts.get(0, 0);
            assertThat(res)
                .hasSize(0);

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            res = await ts.get(0, 10);

            assertThat(res)
                .hasSize(10);

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(2);

            res = await ts.get(0, 7);
            assertThat(res)
                .hasSize(7);

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(2);

            res = await ts.get(0, 20);
            assertThat(res)
                .hasSize(20);

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(3);

            res = await ts.get(0, 25);
            assertThat(res)
                .hasSize(21);

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(3);
        }
    });

    it("testRanges", async () => {
        const baseLine = testContext.utcToday();
        const id = "users/1-A";

        {
            const session = store.openSession();
            await session.store(new User(), id);
            const tsf = session.timeSeriesFor(id, "raven");

            for (let i = 0; i <= 10; i++) {
                tsf.append(addMinutes(baseLine, i), [ i ], "watches/apple");
            }
            for (let i = 12; i <= 13; i++) {
                tsf.append(addMinutes(baseLine, i), [ i ], "watches/apple");
            }
            for (let i = 16; i <= 20; i++) {
                tsf.append(addMinutes(baseLine, i), [ i ], "watches/apple");
            }

            await session.saveChanges();
        }

        let rangesList: TimeSeriesRange[] = [
            {
                from: addMinutes(baseLine, 1),
                to: addMinutes(baseLine, 7),
                name: "raven"
            }
        ];

        const re = store.getRequestExecutor();
        let tsCommand = new GetMultipleTimeSeriesCommand(re.conventions, id, rangesList, 0, TypeUtil.MAX_INT32);
        await re.execute(tsCommand);

        let res = tsCommand.result;

        assertThat(res.values)
            .hasSize(1);
        assertThat(res.values.get("raven"))
            .hasSize(1);

        rangesList = [
            {
                name: "raven",
                from: addMinutes(baseLine, 8),
                to: addMinutes(baseLine, 11)
            }
        ];

        tsCommand = new GetMultipleTimeSeriesCommand(re.conventions, id, rangesList, 0, TypeUtil.MAX_INT32);
        await re.execute(tsCommand);

        res = tsCommand.result;

        assertThat(res.values)
            .hasSize(1);
        assertThat(res.values.get("raven"))
            .hasSize(1);

        rangesList = [
            {
                name: "raven",
                from: addMinutes(baseLine, 8),
                to: addMinutes(baseLine, 17)
            }
        ];

        tsCommand = new GetMultipleTimeSeriesCommand(re.conventions, id, rangesList, 0, TypeUtil.MAX_INT32);
        await re.execute(tsCommand);

        res = tsCommand.result;

        assertThat(res.values)
            .hasSize(1);
        assertThat(res.values.get("raven"))
            .hasSize(1);

        rangesList = [
            {
                name: "raven",
                from: addMinutes(baseLine, 14),
                to: addMinutes(baseLine, 15)
            }
        ];

        tsCommand = new GetMultipleTimeSeriesCommand(re.conventions, id, rangesList, 0, TypeUtil.MAX_INT32);
        await re.execute(tsCommand);

        res = tsCommand.result;

        assertThat(res.values)
            .hasSize(1);
        assertThat(res.values.get("raven"))
            .hasSize(1);

        rangesList = [
            {
                name: "raven",
                from: addMinutes(baseLine, 23),
                to: addMinutes(baseLine, 25)
            }
        ];

        tsCommand = new GetMultipleTimeSeriesCommand(re.conventions, id, rangesList, 0, TypeUtil.MAX_INT32);
        await re.execute(tsCommand);

        res = tsCommand.result;

        assertThat(res.values)
            .hasSize(1);
        assertThat(res.values.get("raven"))
            .hasSize(1);

        rangesList = [
            {
                name: "raven",
                from: addMinutes(baseLine, 20),
                to: addMinutes(baseLine, 26)
            }
        ];

        tsCommand = new GetMultipleTimeSeriesCommand(re.conventions, id, rangesList, 0, TypeUtil.MAX_INT32);
        await re.execute(tsCommand);

        res = tsCommand.result;

        assertThat(res.values)
            .hasSize(1);
        assertThat(res.values.get("raven"))
            .hasSize(1);
    });

    it("testClientCacheWithStart", async () => {
        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            await session.store(new User(), "users/1-A");
            const tsf = session.timeSeriesFor("users/1-A", "Heartrate");

            for (let i = 0; i < 20; i++) {
                tsf.append(addMinutes(baseLine, i), [ i ], "watches/apple");
            }

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const user = await session.load<User>("users/1-A", User);

            const ts = session.timeSeriesFor(user, "Heartrate");

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(1);

            let res = await ts.get(20, TypeUtil.MAX_INT32);
            assertThat(res)
                .hasSize(0);
            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(2);

            res = await ts.get(10, TypeUtil.MAX_INT32);
            assertThat(res)
                .hasSize(10);
            assertThat(res[0].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 10).getTime());
            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(3);

            res = await ts.get(0, TypeUtil.MAX_INT32);

            assertThat(res)
                .hasSize(20);
            assertThat(res[0].timestamp.getTime())
                .isEqualTo(baseLine.getTime());
            assertThat(res[10].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 10).getTime());
            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(4);

            res = await ts.get(10, TypeUtil.MAX_INT32);
            assertThat(res)
                .hasSize(10);
            assertThat(res[0].timestamp.getTime())
                .isEqualTo(addMinutes(baseLine, 10).getTime());

            assertThat(session.advanced.numberOfRequests)
                .isEqualTo(4);

            res = await ts.get(20, TypeUtil.MAX_INT32);
            assertThat(res)
                .hasSize(0);
        }
    });

    it("getResultsWithRange", async () => {
        const baseLine = testContext.utcToday();
        const id = "users/1-A";

        {
            const session = store.openSession();
            await session.store(new User(), id);
            let tsf = session.timeSeriesFor(id, "raven");
            for (let i = 0; i < 8; i++) {
                tsf.append(addMinutes(baseLine, i), [ 64 ], "watches/apple");
            }

            await session.saveChanges();

            const rangesList: TimeSeriesRange[] = [
                {
                    name: "raven",
                    from: baseLine,
                    to: addMinutes(baseLine, 3),
                },
                {
                    name: "raven",
                    from: addMinutes(baseLine, 4),
                    to: addMinutes(baseLine, 7),
                },
                {
                    name: "raven",
                    from: addMinutes(baseLine, 8),
                    to: addMinutes(baseLine, 11),
                }
            ];

            const re = store.getRequestExecutor();

            let tsCommand = new GetMultipleTimeSeriesCommand(store.conventions, id, rangesList, 0, 10);
            await re.execute(tsCommand);

            let res = tsCommand.result;

            assertThat(res.values)
                .hasSize(1);
            assertThat(res.values.get("raven"))
                .hasSize(3);

            assertThat(res.values.get("raven")[0].entries)
                .hasSize(4);
            assertThat(res.values.get("raven")[1].entries)
                .hasSize(4);
            assertThat(res.values.get("raven")[2].entries)
                .hasSize(0);

            tsf = session.timeSeriesFor(id, "raven");
            for (let i = 8; i < 11; i++) {
                tsf.append(addMinutes(baseLine, i), [ 1000 ], "watches/apple");
            }

            await session.saveChanges();

            tsCommand = new GetMultipleTimeSeriesCommand(store.conventions, id, rangesList, 0, 10);

            await re.execute(tsCommand);

            res = tsCommand.result;

            assertThat(res.values)
                .hasSize(1);
            assertThat(res.values.get("raven"))
                .hasSize(3);

            assertThat(res.values.get("raven")[0].entries)
                .hasSize(4);
            assertThat(res.values.get("raven")[1].entries)
                .hasSize(4);
            assertThat(res.values.get("raven")[2].entries)
                .hasSize(2);
        }
    });

    it("resultsWithRangeAndPageSize", async () => {
        const tag = "raven";
        const id = "users/1";

        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            await session.store(new User(), id);
            const tsf = session.timeSeriesFor(id, tag);
            for (let i = 0; i <= 15; i++) {
                tsf.append(addMinutes(baseLine, i), [ i ], "watches/apple");
            }

            await session.saveChanges();
        }

        const rangesList: TimeSeriesRange[] = [
            {
                name: "raven",
                from: baseLine,
                to: addMinutes(baseLine, 3),
            },
            {
                name: "raven",
                from: addMinutes(baseLine, 4),
                to: addMinutes(baseLine, 7),
            },
            {
                name: "raven",
                from: addMinutes(baseLine, 8),
                to: addMinutes(baseLine, 11),
            }
        ];

        const re = store.getRequestExecutor();

        let tsCommand = new GetMultipleTimeSeriesCommand(store.conventions, id, rangesList, 0, 0);
        await re.execute(tsCommand);

        let res = tsCommand.result;
        assertThat(res.values)
            .hasSize(0);

        tsCommand = new GetMultipleTimeSeriesCommand(store.conventions, id, rangesList, 0, 30);
        await re.execute(tsCommand);

        res = tsCommand.result;

        assertThat(res.values)
            .hasSize(1);
        assertThat(res.values.get("raven"))
            .hasSize(3);

        assertThat(res.values.get("raven")[0].entries)
            .hasSize(4);
        assertThat(res.values.get("raven")[1].entries)
            .hasSize(4);
        assertThat(res.values.get("raven")[2].entries)
            .hasSize(4);

        tsCommand = new GetMultipleTimeSeriesCommand(store.conventions, id, rangesList, 0, 6);
        await re.execute(tsCommand);

        res = tsCommand.result;

        assertThat(res.values)
            .hasSize(1);
        assertThat(res.values.get("raven"))
            .hasSize(2);

        assertThat(res.values.get("raven")[0].entries)
            .hasSize(4);
        assertThat(res.values.get("raven")[1].entries)
            .hasSize(2);
    });

    it("resultsWithRangeAndStart", async () => {
        const tag = "raven";
        const id = "users/1";

        const baseLine = testContext.utcToday();

        {
            const session = store.openSession();
            await session.store(new User(), id);
            const tsf = session.timeSeriesFor(id, tag);
            for (let i = 0; i <= 15; i++) {
                tsf.append(addMinutes(baseLine, i), [ i ], "watches/apple");
            }

            await session.saveChanges();
        }

        const rangesList: TimeSeriesRange[] = [
            {
                name: "raven",
                from: baseLine,
                to: addMinutes(baseLine, 3),
            },
            {
                name: "raven",
                from: addMinutes(baseLine, 4),
                to: addMinutes(baseLine, 7),
            },
            {
                name: "raven",
                from: addMinutes(baseLine, 8),
                to: addMinutes(baseLine, 11),
            }
        ];

        const re = store.getRequestExecutor();

        let tsCommand = new GetMultipleTimeSeriesCommand(store.conventions, id, rangesList, 0, 20);

        await re.execute(tsCommand);

        let res = tsCommand.result;

        assertThat(res.values)
            .hasSize(1);
        assertThat(res.values.get("raven"))
            .hasSize(3);

        assertThat(res.values.get("raven")[0].entries)
            .hasSize(4);
        assertThat(res.values.get("raven")[1].entries)
            .hasSize(4);
        assertThat(res.values.get("raven")[2].entries)
            .hasSize(4);

        tsCommand = new GetMultipleTimeSeriesCommand(store.conventions, id, rangesList, 3, 20);

        await re.execute(tsCommand);

        res = tsCommand.result;

        assertThat(res.values)
            .hasSize(1);
        assertThat(res.values.get("raven"))
            .hasSize(3);

        assertThat(res.values.get("raven")[0].entries)
            .hasSize(1);
        assertThat(res.values.get("raven")[1].entries)
            .hasSize(4);
        assertThat(res.values.get("raven")[2].entries)
            .hasSize(4);

        tsCommand = new GetMultipleTimeSeriesCommand(store.conventions, id, rangesList, 9, 20);
        await re.execute(tsCommand);

        res = tsCommand.result;

        assertThat(res.values)
            .hasSize(1);
        assertThat(res.values.get("raven"))
            .hasSize(3);

        assertThat(res.values.get("raven")[0].entries)
            .hasSize(0);
        assertThat(res.values.get("raven")[1].entries)
            .hasSize(0);
        assertThat(res.values.get("raven")[2].entries)
            .hasSize(3);
    });
});
