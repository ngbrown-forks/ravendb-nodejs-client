import { MultiTypeHiLoIdGenerator } from "./MultiTypeHiLoIdGenerator.js";
import { DocumentStore } from "../DocumentStore.js";
import { IRavenObject } from "../../Types/IRavenObject.js";
import { DocumentStoreBase } from "../DocumentStoreBase.js";
import { IHiLoIdGenerator } from "./IHiLoIdGenerator.js";
import { TypeUtil } from "../../Utility/TypeUtil.js";
import { ObjectTypeDescriptor } from "../../Types/index.js";

export class MultiDatabaseHiLoIdGenerator implements IHiLoIdGenerator {

    protected readonly _store: DocumentStore;

    private _generators: IRavenObject<MultiTypeHiLoIdGenerator> = {};

    constructor(store: DocumentStore) {
        this._store = store;
    }

    public generateDocumentId(database: string, entity: object): Promise<string> {
        return this._getGeneratorForDatabase(DocumentStoreBase.getEffectiveDatabase(this._store, database))
            .generateDocumentId(entity);
    }

    protected _getGeneratorForDatabase(database: string): MultiTypeHiLoIdGenerator {
        if (!(database in this._generators)) {
            this._generators[database] = new MultiTypeHiLoIdGenerator(this._store, database);
        }

        return this._generators[database];
    }

    public async returnUnusedRange() {
        for (const [key, generator] of Object.entries(this._generators)) {
            await generator.returnUnusedRange();
        }
    }

    public generateNextIdFor(database: string, collectionName: string): Promise<number>;
    public generateNextIdFor(database: string, documentType: ObjectTypeDescriptor<any>): Promise<number>;
    public generateNextIdFor(database: string, entity: object): Promise<number>;
    public generateNextIdFor(database: string, target: string | ObjectTypeDescriptor | object): Promise<number> {
        if (TypeUtil.isString(target)) {
            return this._generateNextIdFor(database, target);
        }

        if (TypeUtil.isObjectTypeDescriptor(target)) {
            const collectionName = this._store.conventions.getCollectionNameForType(target);
            return this._generateNextIdFor(database, collectionName);
        }

        const collectionName = this._store.conventions.getCollectionNameForEntity(target);
        return this._generateNextIdFor(database, collectionName);
    }

    private async _generateNextIdFor(database: string, collectionName: string): Promise<number> {
        database = this._store.getEffectiveDatabase(database);

        if (!(database in this._generators)) {
            this._generators[database] = new MultiTypeHiLoIdGenerator(this._store, database);
        }

        return this._generators[database].generateNextIdFor(collectionName);
    }
}
