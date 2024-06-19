import assert from "node:assert"
import { testContext, disposeTestDocumentStore } from "../../Utils/TestUtil.js";

import {
    IDocumentStore,
    GetIndexNamesOperation,
    DisableIndexOperation,
    GetIndexingStatusOperation,
    IndexStatus,
    EnableIndexOperation,
    IndexDefinition,
    GetIndexesOperation,
    GetIndexesStatisticsOperation,
    IndexStats,
    GetTermsOperation,
    PutIndexesOperation,
    IndexHasChangedOperation,
    StopIndexingOperation,
    StartIndexingOperation,
    StopIndexOperation,
    StartIndexOperation,
    SetIndexesLockOperation,
    GetIndexOperation,
    SetIndexesPriorityOperation,
    GetIndexErrorsOperation,
    GetIndexStatisticsOperation,
    AbstractCsharpIndexCreationTask,
    SetIndexesLockOperationParameters,
    SetIndexesPriorityOperationParameters,
    AbstractJavaScriptIndexCreationTask
} from "../../../src/index.js";
import { UsersIndex, UsersInvalidIndex, UsersIndexWithPascalCasedFields } from "../../Assets/Indexes.js";
import { TypeUtil } from "../../../src/Utility/TypeUtil.js";
import { assertThat } from "../../Utils/AssertExtensions.js";

describe("Index operations", function () {

    let store: IDocumentStore;

    class User {
        constructor(public name: string, public age?: number) {
            // empty
        }
    }

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    let usersIndex: AbstractJavaScriptIndexCreationTask<User>;
    let invalidUsersIndex: AbstractCsharpIndexCreationTask;
    let usersIndexWithPascalCasedFields: AbstractJavaScriptIndexCreationTask<any>;

    beforeEach(() => {
        usersIndex = new UsersIndex();
        invalidUsersIndex = new UsersInvalidIndex();
        usersIndexWithPascalCasedFields = new UsersIndexWithPascalCasedFields();
    });

    it("can delete index", async () => {
        await usersIndex.execute(store);

        const indexNames = await store.maintenance.send(new GetIndexNamesOperation(0, 10));
        assert.ok(indexNames.find(x => x === "UsersIndex"));
    });

    it("can disable and enable index", async () => {
        await usersIndex.execute(store);

        await store.maintenance.send(new DisableIndexOperation(usersIndex.getIndexName()));
        let indexingStatus = await store.maintenance.send(new GetIndexingStatusOperation());
        let indexStatus: IndexStatus = indexingStatus.indexes[0];
        assert.strictEqual(indexStatus.status, "Disabled");

        await store.maintenance.send(new EnableIndexOperation(usersIndex.getIndexName()));
        indexingStatus = await store.maintenance.send(new GetIndexingStatusOperation());
        assert.strictEqual(indexingStatus.status, "Running");

        indexingStatus = await store.maintenance.send(new GetIndexingStatusOperation());
        indexStatus = indexingStatus.indexes[0];
        assertThat(indexStatus.status)
            .isEqualTo("Running");
    });

    it("can get indexes", async () => {
        await usersIndex.execute(store);
        const indexDefinitions: IndexDefinition[] = await store.maintenance.send(new GetIndexesOperation(0, 10));
        assert.strictEqual(indexDefinitions.length, 1);
        assert.strictEqual(indexDefinitions[0].constructor, IndexDefinition);
        assert.ok(TypeUtil.isSet(indexDefinitions[0].maps));
    });

    it("can get indexes stats", async () => {
        await usersIndex.execute(store);

        const indexStats: IndexStats[] = await store.maintenance.send(new GetIndexesStatisticsOperation());
        assert.strictEqual(indexStats.length, 1);
        assert.ok(TypeUtil.isMap(indexStats[0].collections));
        assert.strictEqual(indexStats[0].collections.size, 1);
    });

    it("can get terms", async () => {
        await usersIndex.execute(store);

        const session = store.openSession();
        const user = new User("Marcin");
        await session.store(user);
        await session.saveChanges();

        await testContext.waitForIndexing(store, store.database);
        const terms: string[] = await store.maintenance.send(new GetTermsOperation("UsersIndex", "name", null));

        assert.strictEqual(terms.length, 1);
        assert.strictEqual(terms[0], "marcin");
    });

    it("can tell if index changed", async () => {
        const indexDef = usersIndex.createIndexDefinition();
        await store.maintenance.send(new PutIndexesOperation(indexDef));

        let hasIndexChanged = await store.maintenance.send(new IndexHasChangedOperation(indexDef));
        assert.ok(!hasIndexChanged);

        indexDef.maps = new Set(["from users"]);
        hasIndexChanged = await store.maintenance.send(new IndexHasChangedOperation(indexDef));
        assert.ok(hasIndexChanged);
    });

    it("can stop/start indexing", async () => {
        const indexDef = usersIndex.createIndexDefinition();
        await store.maintenance.send(new PutIndexesOperation(indexDef));
        await store.maintenance.send(new StopIndexingOperation());

        let indexingStatus = await store.maintenance.send(new GetIndexingStatusOperation());
        assert.strictEqual(indexingStatus.status, "Paused");
        await store.maintenance.send(new StartIndexingOperation());
        indexingStatus = await store.maintenance.send(new GetIndexingStatusOperation());
        assert.strictEqual(indexingStatus.status, "Running");
    });

    it("can stop/start index", async () => {
        const indexDef = usersIndex.createIndexDefinition();
        await store.maintenance.send(new PutIndexesOperation(indexDef));
        await store.maintenance.send(new StopIndexOperation(indexDef.name));

        let indexingStatus = await store.maintenance.send(new GetIndexingStatusOperation());
        assert.strictEqual(indexingStatus.status, "Running");
        assert.strictEqual(indexingStatus.indexes[0].status, "Paused");

        await store.maintenance.send(new StartIndexOperation(indexDef.name));
        indexingStatus = await store.maintenance.send(new GetIndexingStatusOperation());
        assert.strictEqual(indexingStatus.status, "Running");
        assert.strictEqual(indexingStatus.indexes[0].status, "Running");

    });

    it("can set index lock mode - single index", async () => {
        const indexDef = usersIndex.createIndexDefinition();
        await store.maintenance.send(new PutIndexesOperation(indexDef));
        await store.maintenance.send(new SetIndexesLockOperation(indexDef.name, "LockedError"));

        const newIndexDef = await store.maintenance.send(new GetIndexOperation(indexDef.name));
        assert.strictEqual(newIndexDef.lockMode, "LockedError");
    });
    
    it("can set index lock mode - multiple indexes", async () => {
        const indexDef1 = usersIndex.createIndexDefinition();
        const indexDef2 = usersIndexWithPascalCasedFields.createIndexDefinition();
        
        await store.maintenance.send(new PutIndexesOperation(indexDef1));
        await store.maintenance.send(new PutIndexesOperation(indexDef2));
        
        const params: SetIndexesLockOperationParameters = {
            indexNames: [indexDef1.name, indexDef2.name],
            mode: "LockedIgnore"
        }
        
        await store.maintenance.send(new SetIndexesLockOperation(params));
        
        const newIndexDef1 = await store.maintenance.send(new GetIndexOperation(indexDef1.name));
        const newIndexDef2 = await store.maintenance.send(new GetIndexOperation(indexDef2.name));
        
        assert.strictEqual(newIndexDef1.lockMode, "LockedIgnore");
        assert.strictEqual(newIndexDef2.lockMode, "LockedIgnore");
    });

    it("can set index priority - single index", async () => {
        const indexDef = usersIndex.createIndexDefinition();
        await store.maintenance.send(new PutIndexesOperation(indexDef));
        await store.maintenance.send(new SetIndexesPriorityOperation(indexDef.name, "High"));

        const newIndexDef = await store.maintenance.send(new GetIndexOperation(indexDef.name));
        assert.strictEqual(newIndexDef.priority, "High");
    });

    it("can set index priority - multiple indexes", async () => {
        const indexDef1 = usersIndex.createIndexDefinition();
        const indexDef2 = usersIndexWithPascalCasedFields.createIndexDefinition();

        await store.maintenance.send(new PutIndexesOperation(indexDef1));
        await store.maintenance.send(new PutIndexesOperation(indexDef2));

        const params: SetIndexesPriorityOperationParameters = {
            indexNames: [indexDef1.name, indexDef2.name],
            priority: "High"
        }

        await store.maintenance.send(new SetIndexesPriorityOperation(params));

        const newIndexDef1 = await store.maintenance.send(new GetIndexOperation(indexDef1.name));
        const newIndexDef2 = await store.maintenance.send(new GetIndexOperation(indexDef2.name));

        assert.strictEqual(newIndexDef1.priority, "High");
        assert.strictEqual(newIndexDef2.priority, "High");
    });

    it("can list errors", async () => {
        const indexDef = invalidUsersIndex.createIndexDefinition();

        await store.maintenance.send(new PutIndexesOperation(indexDef));

        const session = store.openSession();
        const user = new User(null, 0);
        await session.store(user);
        await session.saveChanges();

        await testContext.waitForIndexing(store, store.database, null, false);

        await testContext.waitForValue(async () => {
            const errors = await store.maintenance.send(new GetIndexErrorsOperation());
            return errors[0].errors.length;
        }, 1);

        await testContext.waitForValue(async () => {
            const errors = await store.maintenance.send(new GetIndexErrorsOperation([indexDef.name]));
            return errors[0].errors.length;
        }, 1);

        const indexErrors = await store.maintenance.send(new GetIndexErrorsOperation());
        const perIndexErrors = await store.maintenance.send(new GetIndexErrorsOperation([indexDef.name]));

        assert.strictEqual(indexErrors.length, 1);
        assert.strictEqual(perIndexErrors.length, 1);
        assertThat(indexErrors[0].errors)
            .hasSize(1);
        assertThat(perIndexErrors[0].errors)
            .hasSize(1);
    });

    it("can get index statistics", async () => {
        const indexDef = usersIndex.createIndexDefinition();
        await store.maintenance.send(new PutIndexesOperation(indexDef));

        const session = store.openSession();
        const user = new User(null, 0);
        await session.store(user);
        await session.saveChanges();

        await testContext.waitForIndexing(store, store.database);
        const stats = await store.maintenance.send(new GetIndexStatisticsOperation(indexDef.name));
        assert.strictEqual(stats.entriesCount, 1);
    });

    it("can get index with Pascal-cased fields", async () => {
        const indexDef = usersIndexWithPascalCasedFields.createIndexDefinition();
        await store.maintenance.send(new PutIndexesOperation(indexDef));

        const newIndexDef = await store.maintenance.send(new GetIndexOperation(indexDef.name));
        assert.ok(newIndexDef.fields["Name"]);
        assert.ok(!newIndexDef.fields["name"]);
    });
});
