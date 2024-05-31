import { DatabaseLockMode, DatabaseRecord } from "../../index.js";
import { DocumentsCompressionConfiguration } from "../../DocumentsCompressionConfiguration.js";
import { SorterDefinition } from "../../../Documents/Queries/Sorting/SorterDefinition.js";
import { AnalyzerDefinition } from "../../../Documents/Indexes/Analysis/AnalyzerDefinition.js";
import { IndexDefinition } from "../../../Documents/Indexes/IndexDefinition.js";
import { RevisionsConfiguration } from "../../../Documents/Operations/RevisionsConfiguration.js";
import { IBackupConfigurationBuilder } from "./IBackupConfigurationBuilder.js";
import { IConnectionStringConfigurationBuilder } from "./IConnectionStringConfigurationBuilder.js";
import { ClientConfiguration } from "../../../Documents/Operations/Configuration/ClientConfiguration.js";
import { StudioConfiguration } from "../../../Documents/Operations/Configuration/StudioConfiguration.js";
import { RefreshConfiguration } from "../../../Documents/Operations/Refresh/RefreshConfiguration.js";
import { ExpirationConfiguration } from "../../../Documents/Operations/Expiration/ExpirationConfiguration.js";
import { TimeSeriesConfiguration } from "../../../Documents/Operations/TimeSeries/TimeSeriesConfiguration.js";
import { IEtlConfigurationBuilder } from "./IEtlConfigurationBuilder.js";
import { IIntegrationConfigurationBuilder } from "./IIntegrationConfigurationBuilder.js";
import { IReplicationConfigurationBuilder } from "./IReplicationConfigurationBuilder.js";


export interface IDatabaseRecordBuilderBase {
    toDatabaseRecord(): DatabaseRecord;
    disabled(): this;
    encrypted(): this;
    withLockMode(lockMode: DatabaseLockMode): this;
    configureDocumentsCompression(configuration: DocumentsCompressionConfiguration): this;
    withSorters(...sorterDefinitions: SorterDefinition[]): this;
    withAnalyzers(...analyzerDefinitions: AnalyzerDefinition[]): this;
    withIndexes(...indexDefinitions: IndexDefinition[]): this;
    withSettings(settings: Record<string, string>): this;
    configureRevisions(configuration: RevisionsConfiguration): this;
    withEtls(builder: (builder: IEtlConfigurationBuilder) => void): this;
    withBackups(builder: (builder: IBackupConfigurationBuilder) => void): this;
    withReplication(builder: (builder: IReplicationConfigurationBuilder) => void): this;
    withConnectionStrings(builder : (builder: IConnectionStringConfigurationBuilder) => void): this;
    configureClient(configuration: ClientConfiguration): this;
    configureStudio(configuration: StudioConfiguration): this;
    configureRefresh(configuration: RefreshConfiguration): this;
    configureExpiration(configuration: ExpirationConfiguration): this;
    configureTimeSeries(configuration: TimeSeriesConfiguration): this;
    withIntegrations(builder: (builder: IIntegrationConfigurationBuilder) => void): this;
}
