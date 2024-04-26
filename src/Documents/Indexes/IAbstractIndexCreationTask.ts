import { IndexPriority, IndexState } from "./Enums.js";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";
import { IndexDefinition } from "./IndexDefinition.js";
import { IDocumentStore } from "../IDocumentStore.js";
import { IndexDeploymentMode } from "./IndexDeploymentMode.js";

export interface IAbstractIndexCreationTask {

    getIndexName(): string;
    priority: IndexPriority;
    state: IndexState;
    deploymentMode: IndexDeploymentMode;
    conventions: DocumentConventions;

    createIndexDefinition(): IndexDefinition;

    execute(store: IDocumentStore): Promise<void>;
    execute(store: IDocumentStore, conventions: DocumentConventions): Promise<void>;
    execute(store: IDocumentStore, conventions: DocumentConventions, database: string): Promise<void>;
}