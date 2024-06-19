import { HiloIdGenerator } from "./HiloIdGenerator.js";
import { acquireSemaphore } from "../../Utility/SemaphoreUtil.js";
import { IRavenObject } from "../../Types/IRavenObject.js";
import { DocumentStore } from "../DocumentStore.js";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";
import { Semaphore } from "../../Utility/Semaphore.js";

export class MultiTypeHiLoIdGenerator {
    private readonly _sem: Semaphore;
    protected _idGeneratorsByTag: IRavenObject<HiloIdGenerator> = {};
    protected readonly _store: DocumentStore;
    protected readonly _dbName: string;
    protected readonly _conventions: DocumentConventions;
    private _identityPartsSeparator: string;

    constructor(store: DocumentStore, dbName?: string) {
        this._store = store;
        this._dbName = dbName;
        this._sem = new Semaphore();
        this._conventions = store.getRequestExecutor(dbName).conventions;
        this._identityPartsSeparator = this._conventions.identityPartsSeparator;
    }

    public async generateDocumentId(entity: object, documentType?: string): Promise<string> {
        const identityPartsSeparator = this._conventions.identityPartsSeparator;
        if (this._identityPartsSeparator !== identityPartsSeparator) {
            await this._maybeRefresh(identityPartsSeparator);
        }
        const entityType = this._conventions.getJsTypeByDocumentType(documentType);
        const typeTagName: string = entityType
            ? this._conventions.getCollectionNameForType(entityType)
            : this._conventions.getCollectionNameForEntity(entity);

        if (!typeTagName) {
            return null;
        }

        const tag = this._conventions.transformClassCollectionNameToDocumentIdPrefix(typeTagName);

        let value = this._idGeneratorsByTag[tag];
        if (value) {
            return await value.generateDocumentId(entity);
        }

        const acquiredSem = acquireSemaphore(this._sem);

        await acquiredSem.promise;
        try {
            value = this._idGeneratorsByTag[tag];

            if (value) {
                return value.generateDocumentId(entity);
            }

            value = this._createGeneratorFor(tag);
            this._idGeneratorsByTag[tag] = value;
        } finally {
            acquiredSem.dispose();
        }

        return value.generateDocumentId(entity);
    }

    private async _maybeRefresh(identityPartsSeparator: string) {
        let idGenerators: HiloIdGenerator[];

        const acquiredSem = acquireSemaphore(this._sem);
        try {
            await acquiredSem.promise;

            if (this._identityPartsSeparator === identityPartsSeparator) {
                return;
            }

            idGenerators = Object.entries(this._idGeneratorsByTag).map(x => x[1] as HiloIdGenerator);

            this._idGeneratorsByTag = {};
            this._identityPartsSeparator = identityPartsSeparator;

        } finally {
            acquiredSem.dispose();
        }

        if (idGenerators) {
            try {
                await MultiTypeHiLoIdGenerator._returnUnusedRange(idGenerators);
            } catch {
                // ignore
            }
        }
    }

    public async generateNextIdFor(collectionName: string): Promise<number> {
        let value = this._idGeneratorsByTag[collectionName];
        if (value) {
            const nextId = await value.getNextId();
            return nextId.id;
        }

        const acquiredSem = acquireSemaphore(this._sem);
        try {
            await acquiredSem.promise;

            value = this._idGeneratorsByTag[collectionName];
            if (value) {
                const nextId = await value.getNextId();
                return nextId.id;
            }

            value = this._createGeneratorFor(collectionName);
            this._idGeneratorsByTag[collectionName] = value;

        } finally {
            acquiredSem.dispose();
        }

        const nextId = await value.getNextId();
        return nextId.id;

    }

    protected _createGeneratorFor(tag: string): HiloIdGenerator {
        return new HiloIdGenerator(tag, this._store, this._dbName, this._identityPartsSeparator);
    }

    public async returnUnusedRange() {
        await MultiTypeHiLoIdGenerator._returnUnusedRange(Object.values<HiloIdGenerator>(this._idGeneratorsByTag));
    }

    private static async _returnUnusedRange(generators: HiloIdGenerator[]) {
        for (const generator of generators) {
            await generator.returnUnusedRange();
        }
    }
}
