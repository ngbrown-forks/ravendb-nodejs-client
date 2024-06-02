import {
    AnalyzerDefinition,
    ClientConfiguration,
    CreateDatabaseOperation,
    DatabaseRecord,
    DatabaseTopology,
    DeleteDatabasesOperation,
    DocumentsCompressionConfiguration,
    ExpirationConfiguration,
    GetDatabaseRecordOperation,
    IDocumentStore, IndexDefinition, PeriodicBackupConfiguration,
    RefreshConfiguration,
    RevisionsCollectionConfiguration,
    RevisionsConfiguration, SorterDefinition,
    StudioConfiguration,
    TimeSeriesConfiguration
} from "../../../src/index.js";
import { disposeTestDocumentStore, testContext } from "../../Utils/TestUtil.js";
import { assertThat, assertThrows } from "../../Utils/AssertExtensions.js";
import {
    IDatabaseRecordBuilderInitializer
} from "../../../src/ServerWide/Operations/Builder/IDatabaseRecordBuilderInitializer.js";
import { DatabaseRecordBuilder } from "../../../src/ServerWide/Operations/DatabaseRecordBuilder.js";
import { OrchestratorTopology } from "../../../src/ServerWide/OrchestratorTopology.js";

describe("RavenDB_19938Test", function () {
    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("can_Create_Database_Via_Builder", async function() {
        const database = store.database + "test";

        await store.maintenance.server.send(new CreateDatabaseOperation(builder => builder.regular(database)));

        try {
            const databaseRecord = await store.maintenance.server.send(new GetDatabaseRecordOperation(database));
            assertThat(databaseRecord)
                .isNotNull();
        } finally {
            await store.maintenance.server.send(new DeleteDatabasesOperation({
                databaseNames: [database],
                hardDelete: true
            }));
        }
    })

    it("can_Create_Sharded_Database_Via_Builder", async function() {
        const database = store.database + "test";

        await store.maintenance.server.send(new CreateDatabaseOperation(
            builder => builder.sharded(database,
                    s => s.addShard(0,
                            b =>
                                b.addNode("A")))));

        try {
            const databaseRecord = await store.maintenance.server.send(new GetDatabaseRecordOperation(database));
            assertThat(databaseRecord)
                .isNotNull();
        } finally {
            await store.maintenance.server.send(new DeleteDatabasesOperation({
                databaseNames: [database],
                hardDelete: true
            }))
        }
    });


    it("regular", async function () {
        let record = createDatabaseRecord(builder => builder.regular("DB1"));

        assertThat(record.databaseName)
            .isEqualTo("DB1");

        const databaseTopology = {
            members: ["A"],
        } as DatabaseTopology;

        record = createDatabaseRecord(builder => builder.regular("DB1").withTopology(databaseTopology));

        assertThat(record.topology.members)
            .hasSize(1)
            .contains("A");

        record = createDatabaseRecord(builder =>
            builder.regular("DB1").withTopology(topology =>
                topology.addNode("B").addNode("C")));

        assertThat(record.topology.members)
            .hasSize(2)
            .contains("B")
            .contains("C");

        record = createDatabaseRecord(builder => builder.regular("DB1").withReplicationFactor(3));
        assertThat(record.topology.members)
            .hasSize(0);
        assertThat(record.topology.replicationFactor)
            .isEqualTo(3);

        record = createDatabaseRecord(builder => builder.regular("DB1").disabled());

        assertThat(record.disabled)
            .isTrue();

        const clientConfiguration = {
            identityPartsSeparator: "z"
        } as ClientConfiguration;

        record = createDatabaseRecord(builder => builder.regular("DB1").configureClient(clientConfiguration));

        assertThat(record.client.identityPartsSeparator)
            .isEqualTo("z");

        const documentsCompressionConfiguration = {
            collections: ["Orders"]
        } as DocumentsCompressionConfiguration;

        record = createDatabaseRecord(builder => builder.regular("DB1").configureDocumentsCompression(documentsCompressionConfiguration));

        assertThat(record.documentsCompression.collections)
            .hasSize(1)
            .contains("Orders");

        const expirationConfiguration = {
            deleteFrequencyInSec: 777
        } as ExpirationConfiguration;

        record = createDatabaseRecord(builder => builder.regular("DB1").configureExpiration(expirationConfiguration));

        assertThat(record.expiration.deleteFrequencyInSec)
            .isEqualTo(777);

        const refreshConfiguration = {
             refreshFrequencyInSec: 333
        } as RefreshConfiguration;

        record = createDatabaseRecord(builder => builder.regular("DB1").configureRefresh(refreshConfiguration));

        assertThat(record.refresh.refreshFrequencyInSec)
            .isEqualTo(333);

        const revisionsCollectionConfiguration = new RevisionsCollectionConfiguration();
        revisionsCollectionConfiguration.disabled = true;

        const revisionsConfiguration = new RevisionsConfiguration();
        revisionsConfiguration.defaultConfig = revisionsCollectionConfiguration;
        record = createDatabaseRecord(builder => builder.regular("DB1").configureRevisions(revisionsConfiguration));

        assertThat(record.revisions.defaultConfig.disabled)
            .isTrue();

        const studioConfiguration = {
            environment: "Production"
        } as StudioConfiguration;

        record = createDatabaseRecord(builder => builder.regular("DB1").configureStudio(studioConfiguration));

        assertThat(record.studio.environment)
            .isEqualTo("Production");

        const timeSeriesConfiguration = new TimeSeriesConfiguration();
        timeSeriesConfiguration.policyCheckFrequencyInMs = 555_000;

        record = createDatabaseRecord(builder => builder.regular("DB1").configureTimeSeries(timeSeriesConfiguration));

        assertThat(record.timeSeries.policyCheckFrequencyInMs)
            .isEqualTo(555_000);

        const analyzer1: AnalyzerDefinition = {
            name: "A1",
            code: null
        };

        const analyzer2: AnalyzerDefinition = {
            name: "A2",
            code: null
        };

        record = createDatabaseRecord(builder => builder
            .regular("DB1")
            .withAnalyzers(analyzer1)
            .withAnalyzers(analyzer2)
        );

        assertThat(record.analyzers)
            .hasSize(2);

        const sorter1: SorterDefinition = {
            name: "S1",
            code: null
        };
        const sorter2: SorterDefinition = {
            name: "S2",
            code: null
        };

        record = createDatabaseRecord(builder => builder
            .regular("DB1")
            .withSorters(sorter1)
            .withSorters(sorter2)
        );

        assertThat(record.sorters)
            .hasSize(2);

        record = createDatabaseRecord(builder => builder.regular("DB1").encrypted());

        assertThat(record.encrypted)
            .isTrue();

        const backup1: PeriodicBackupConfiguration = {
            disabled: true
        };
        record = createDatabaseRecord(builder => builder
            .regular("DB1")
            .withBackups(b => b.addPeriodicBackup(backup1)));

        assertThat(record.periodicBackups)
            .hasSize(1);
    });

    it("sharded", async function () {
        const t1 = {
            members: ["B", "C"]
        } as DatabaseTopology;

        let record = createDatabaseRecord(builder =>
            builder.sharded("DB1", topology => topology
                .addShard(0, shard => shard.addNode("A"))
                .addShard(1, t1)
                .addShard(2, shard => shard.addNode("C").addNode("A"))));

        assertThat(record.sharding.shards[0].members)
            .hasSize(1)
            .contains("A");
        assertThat(record.sharding.shards[1].members)
            .hasSize(2)
            .contains("B")
            .contains("C");
        assertThat(record.sharding.shards[2].members)
            .hasSize(2)
            .contains("C")
            .contains("A");

        const orchestratorTopology = {
            members: ["A"]
        } as OrchestratorTopology;

        await assertThrows(async () =>
            createDatabaseRecord(builder =>
                builder.sharded("DB1",
                        topology => topology.orchestrator(orchestratorTopology))), err => {
            assertThat(err.message)
                .contains("At least one shard is required. Use addShard to add a shard to the topology");
        });

        const ot2 = {
            members: ["A"]
        } as OrchestratorTopology;

        record = createDatabaseRecord(builder =>
            builder.sharded("DB1",
                    topology => topology.orchestrator(ot2).addShard(1, {} as DatabaseTopology)));

        assertThat(record.sharding.orchestrator.topology.members)
            .hasSize(1)
            .contains("A");

        record = createDatabaseRecord(builder => builder.sharded("DB1",
            topology => topology
                .orchestrator(orchestrator =>
                    orchestrator.addNode("B").addNode("C"))
                .addShard(1, {} as DatabaseTopology)));

        assertThat(record.sharding.orchestrator.topology.members)
            .hasSize(2)
            .contains("B")
            .contains("C");
    });

    it("common", async function() {
        let record = createDatabaseRecord(builder => builder.regular("DB1").disabled());

        assertThat(record.disabled)
            .isTrue();

        record = createDatabaseRecord(builder => builder.regular("DB1").encrypted());
        assertThat(record.encrypted)
            .isTrue();

        const analyzerDefinition: AnalyzerDefinition = {
            name: "A1",
            code: null
        };

        record = createDatabaseRecord(builder => builder.regular("DB1").withAnalyzers(analyzerDefinition));
        assertThat(record.analyzers)
            .containsKey("A1");

        const indexDefinition= new IndexDefinition();
        indexDefinition.name = "I1";

        record = createDatabaseRecord(builder => builder.regular("DB1").withIndexes(indexDefinition));

        assertThat(record.indexes)
            .containsKey("I1");

        const sorterDefinition = {
            name: "S1",
            code: null
        } as SorterDefinition;

        record = createDatabaseRecord(builder => builder.regular("DB1").withSorters(sorterDefinition));

        assertThat(record.sorters)
            .containsKey("S1");
    })
})


function createDatabaseRecord(builder: (builder: IDatabaseRecordBuilderInitializer) => void): DatabaseRecord {
    if (!builder) {
        throw new Error("Builder cannot be null");
    }

    const instance = DatabaseRecordBuilder.create();
    builder(instance);

    return instance.toDatabaseRecord();
}