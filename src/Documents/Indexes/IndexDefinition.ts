import { throwError } from "../../Exceptions/index.js";
import { IndexLockMode, IndexType } from "./Enums.js";
import { IndexFieldOptions } from "./IndexFieldOptions.js";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";
import { IndexDefinitionHelper } from "./IndexDefinitionHelper.js";
import { AbstractIndexDefinitionBuilder } from "./AbstractIndexDefinitionBuilder.js";
import { IndexSourceType } from "./IndexSourceType.js";
import { AdditionalAssembly } from "./AdditionalAssembly.js";
import { IndexDeploymentMode } from "./IndexDeploymentMode.js";
import { IndexDefinitionBase } from "./IndexDefinitionBase.js";
import { ArchivedDataProcessingBehavior } from "../DataArchival/ArchivedDataProcessingBehavior.js";

export interface IndexConfiguration {
    [key: string]: string;
}

export class IndexDefinition extends IndexDefinitionBase {

    /**
     * Index lock mode:
     * - Unlock - all index definition changes acceptable
     * - LockedIgnore - all index definition changes will be ignored, only log entry will be created
     * - LockedError - all index definition changes will raise exception
     */
    public lockMode: IndexLockMode;
    public indexType: IndexType;
    public additionalSources: { [key: string]: string } = {};
    public compoundFields: string[][] = [];
    public additionalAssemblies: AdditionalAssembly[] = [];
    public maps: Set<string> = new Set();
    public reduce: string;
    public fields: { [fieldName: string]: IndexFieldOptions } = {};
    private _indexSourceType: IndexSourceType;
    public archivedDataProcessingBehavior: ArchivedDataProcessingBehavior;
    public configuration: IndexConfiguration = {};
    public outputReduceToCollection: string;
    public reduceOutputIndex: number;
    public patternForOutputReduceToCollectionReferences: string;
    public patternReferencesCollectionName: string;
    public deploymentMode: IndexDeploymentMode;

    public toString(): string {
        return this.name;
    }

    public detectStaticIndexSourceType(): IndexSourceType {
        if (!this.maps || !this.maps.size) {
            throwError("InvalidArgumentException", "Index definition contains no Maps");
        }

        let sourceType: IndexSourceType = "None";
        for (const map of this.maps) {
            const mapSourceType = IndexDefinitionHelper.detectStaticIndexSourceType(map);
            if (sourceType === "None") {
                sourceType = mapSourceType;
                continue;
            }

            if (sourceType !== mapSourceType) {
                throwError("InvalidOperationException", "Index definition cannot contain maps with different source types.");
            }
        }

        return sourceType;
    }

    public get sourceType() {
        if (!this._indexSourceType || this._indexSourceType === "None") {
            this._indexSourceType = this.detectStaticIndexSourceType();
        }

        return this._indexSourceType;
    }

    public set sourceType(value: IndexSourceType) {
        this._indexSourceType = value;
    }

    public get type(): IndexType {
        if (!this.indexType || this.indexType === "None") {
            this.indexType = this.detectStaticIndexType();
        }

        return this.indexType;
    }

    public set type(indexType) {
        this.indexType = indexType;
    }

    public detectStaticIndexType(): IndexType {
        const firstMap = this.maps.values().next().value;

        if (!firstMap) {
            throwError("InvalidArgumentException", "Index  definitions contains no Maps");
        }

        return IndexDefinitionHelper.detectStaticIndexType(firstMap, this.reduce);
    }
}

export class IndexDefinitionBuilder extends AbstractIndexDefinitionBuilder<IndexDefinition>{

    public map: string;
    public archivedDataProcessingBehavior: ArchivedDataProcessingBehavior;

    public constructor(indexName?: string) {
        super(indexName);
    }

    protected _newIndexDefinition(): IndexDefinition {
        return new IndexDefinition();
    }

    public toIndexDefinition(conventions: DocumentConventions, validateMap: boolean = true) {
        if (!this.map && validateMap) {
            throwError("InvalidArgumentException",
                "Map is required to generate an index, you cannot create an index without a valid Map property (in index " + this._indexName + ").");
        }

        const indexDefinition = super.toIndexDefinition(conventions, validateMap);
        indexDefinition.archivedDataProcessingBehavior = this.archivedDataProcessingBehavior;
        return indexDefinition;
    }

    protected _toIndexDefinition(indexDefinition: IndexDefinition, conventions: DocumentConventions) {
        if (!this.map) {
            return;
        }

        indexDefinition.maps.add(this.map);
    }
}
