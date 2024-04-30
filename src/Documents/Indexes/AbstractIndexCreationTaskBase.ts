import { DocumentConventions } from "../Conventions/DocumentConventions.js";
import { IndexDefinition } from "./IndexDefinition.js";
import { IndexPriority, IndexLockMode, IndexState, SearchEngineType } from "./Enums.js";
import { IDocumentStore } from "../IDocumentStore.js";
import { PutIndexesOperation } from "../Operations/Indexes/PutIndexesOperation.js";
import { AbstractCommonApiForIndexes } from "./AbstractCommonApiForIndexes.js";
import { IAbstractIndexCreationTask } from "./IAbstractIndexCreationTask.js";
import { DocumentStoreBase } from "../DocumentStoreBase.js";
import { IndexDeploymentMode } from "./IndexDeploymentMode.js";
import { INDEXES } from "../../Constants.js";

export abstract class AbstractIndexCreationTaskBase<TIndexDefinition extends IndexDefinition>
    extends AbstractCommonApiForIndexes implements IAbstractIndexCreationTask {

    /**
     *  Creates the index definition.
     */
    public abstract createIndexDefinition(): TIndexDefinition;

    public conventions: DocumentConventions;
    public priority: IndexPriority;
    public lockMode: IndexLockMode;

    public deploymentMode: IndexDeploymentMode;
    public searchEngineType: SearchEngineType;
    public state: IndexState;

    /**
     * Executes the index creation against the specified document store.
     */
    public async execute(store: IDocumentStore): Promise<void>;
    /**
     * Executes the index creation against the specified document store.
     */
    public async execute(store: IDocumentStore, conventions: DocumentConventions): Promise<void>;
    /**
     * Executes the index creation against the specified document store.
     */
    public async execute(store: IDocumentStore, conventions: DocumentConventions, database: string): Promise<void>;
    public async execute(
        store: IDocumentStore,
        conventions?: DocumentConventions,
        database?: string): Promise<void> {
        if (!conventions && !database) {
            return store.executeIndex(this);
        }

        return this._putIndex(store, conventions, database);
    }

    private async _putIndex(
        store: IDocumentStore, conventions: DocumentConventions, database: string): Promise<void> {
        const oldConventions = this.conventions;

        try {
            database = DocumentStoreBase.getEffectiveDatabase(store, database);
            this.conventions = conventions || this.conventions || store.getRequestExecutor(database).conventions;

            const indexDefinition = this.createIndexDefinition();
            indexDefinition.name = this.getIndexName();

            if (this.lockMode) {
                indexDefinition.lockMode = this.lockMode;
            }

            if (this.priority) {
                indexDefinition.priority = this.priority;
            }

            if (this.state) {
                indexDefinition.state = this.state;
            }

            if (this.deploymentMode) {
                indexDefinition.deploymentMode = this.deploymentMode;
            }

            if (this.searchEngineType) {
                indexDefinition.configuration[INDEXES.INDEXING_STATIC_SEARCH_ENGINE_TYPE] = this.searchEngineType;
            }

            await store.maintenance.forDatabase(database)
                .send(new PutIndexesOperation(indexDefinition));
        } finally {
            this.conventions = oldConventions;
        }
    }

}
