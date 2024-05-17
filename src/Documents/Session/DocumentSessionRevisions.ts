import {
    IRevisionsSessionOperations,
    SessionRevisionsMetadataOptions,
    SessionRevisionsOptions
} from "./IRevisionsSessionOperations.js";
import { InMemoryDocumentSessionOperations } from "./InMemoryDocumentSessionOperations.js";
import { MetadataAsDictionary } from "../../Mapping/MetadataAsDictionary.js";
import { GetRevisionOperation } from "./Operations/GetRevisionOperation.js";
import { TypeUtil } from "../../Utility/TypeUtil.js";
import { DocumentType } from "../DocumentAbstractions.js";
import { RevisionsCollectionObject } from "../../Types/index.js";
import { DocumentSessionRevisionsBase } from "./DocumentSessionRevisionsBase.js";
import { LazyRevisionOperations } from "./Operations/Lazy/LazyRevisionOperations.js";
import { DocumentSession } from "./DocumentSession.js";
import { GetRevisionsCountOperation } from "./Operations/GetRevisionsCountOperation.js";
import { ILazyRevisionsOperations } from "./ILazyRevisionsOperations.js";
import { IMetadataDictionary } from "./IMetadataDictionary.js";

export class DocumentSessionRevisions extends DocumentSessionRevisionsBase implements IRevisionsSessionOperations {

    public constructor(session: InMemoryDocumentSessionOperations) {
        super(session);
    }

    get lazily(): ILazyRevisionsOperations {
        return new LazyRevisionOperations(this._session as DocumentSession);
    }

    public async getFor<TEntity extends object>(id: string): Promise<TEntity[]>;
    public async getFor<TEntity extends object>(
        id: string, options: SessionRevisionsOptions<TEntity>): Promise<TEntity[]>;
    public async getFor<TEntity extends object>(
        id: string, options?: SessionRevisionsOptions<TEntity>): Promise<TEntity[]> {
        options = Object.assign({
            pageSize: 25,
            start: 0
        } as SessionRevisionsOptions<TEntity>, options || {});

        const operation = new GetRevisionOperation(this._session, id, options.start, options.pageSize);

        const command = operation.createRequest();
        if (!command) {
            return operation.getRevisionsFor(options.documentType);
        }
        if (this._sessionInfo) {
            this._sessionInfo.incrementRequestCount();
        }
        await this._requestExecutor.execute(command, this._sessionInfo);
        operation.result = command.result;
        return operation.getRevisionsFor(options.documentType);
    }

    public async getMetadataFor(id: string): Promise<IMetadataDictionary[]>;
    public async getMetadataFor(id: string, options: SessionRevisionsMetadataOptions): Promise<IMetadataDictionary[]>;
    public async getMetadataFor(id: string, options?: SessionRevisionsMetadataOptions): Promise<IMetadataDictionary[]> {
        options = Object.assign({
            pageSize: 25,
            start: 0
        } as SessionRevisionsMetadataOptions, options || {});
        const operation = new GetRevisionOperation(this._session, id, options.start, options.pageSize, true);
        const command = operation.createRequest();
        if (!command) {
            return operation.getRevisionsMetadataFor();
        }
        if (this._sessionInfo) {
            this._sessionInfo.incrementRequestCount();
        }
        await this._requestExecutor.execute(command, this._sessionInfo);
        operation.result = command.result;
        return operation.getRevisionsMetadataFor();
    }

    public async get<TEntity extends object>(id: string, date: Date): Promise<TEntity | null>;
    public async get<TEntity extends object>(id: string, date: Date, documentType: DocumentType<TEntity>): Promise<TEntity | null>;
    public async get<TEntity extends object>(changeVector: string): Promise<TEntity | null>;
    public async get<TEntity extends object>(changeVector: string,
                                             documentType: DocumentType<TEntity>): Promise<TEntity | null>;
    public async get<TEntity extends object>(changeVectors: string[])
        : Promise<RevisionsCollectionObject<TEntity>>;
    public async get<TEntity extends object>(changeVectors: string[], documentType: DocumentType<TEntity>)
        : Promise<RevisionsCollectionObject<TEntity>>;
    public async get<TEntity extends object>(
        changeVectorOrVectorsOrId: string | string[],
        documentTypeOrDate?: DocumentType<TEntity> | Date,
        documentTypeForDateOverload?: DocumentType<TEntity>)
        : Promise<RevisionsCollectionObject<TEntity> | TEntity> {

        const documentType = TypeUtil.isDocumentType(documentTypeOrDate)
            ? documentTypeOrDate as DocumentType<TEntity>
            : undefined;

        if (TypeUtil.isDate(documentTypeOrDate)) {
            return this._getByIdAndDate(
                changeVectorOrVectorsOrId as string, documentTypeOrDate, documentTypeForDateOverload);
        } else {
            return this._get(changeVectorOrVectorsOrId, documentType);
        }
    }

    private async _getByIdAndDate<TEntity extends object>(
        id: string, date: Date, clazz?: DocumentType<TEntity>) {
        const operation = new GetRevisionOperation(this._session, id, date);
        const command = operation.createRequest();
        if (!command) {
            return operation.getRevision(clazz);
        }
        if (this._sessionInfo) {
            this._sessionInfo.incrementRequestCount();
        }
        await this._requestExecutor.execute(command, this._sessionInfo);
        operation.result = command.result;
        return operation.getRevision(clazz);
    }

    private async _get<TEntity extends object>(changeVectorOrVectors: string | string[],
                                               documentType?: DocumentType<TEntity>)
        : Promise<RevisionsCollectionObject<TEntity> | TEntity> {
        const operation = new GetRevisionOperation(this._session, changeVectorOrVectors as any);

        const command = operation.createRequest();
        if (!command) {
            return TypeUtil.isArray(changeVectorOrVectors)
                ? operation.getRevisions(documentType)
                : operation.getRevision(documentType);
        }
        if (this._sessionInfo) {
            this._sessionInfo.incrementRequestCount();
        }
        await this._requestExecutor.execute(command, this._sessionInfo);
        operation.result = command.result;
        return TypeUtil.isArray(changeVectorOrVectors)
            ? operation.getRevisions(documentType)
            : operation.getRevision(documentType);
    }

    public async getCountFor(id: string): Promise<number> {
        const operation = new GetRevisionsCountOperation(id);
        const command = operation.createRequest();
        if (this._sessionInfo) {
            this._sessionInfo.incrementRequestCount();
        }
        await this._requestExecutor.execute(command, this._sessionInfo);
        return command.result;
    }
}
