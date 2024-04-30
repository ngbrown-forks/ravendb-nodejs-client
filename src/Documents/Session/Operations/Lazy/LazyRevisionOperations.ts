import { ILazyRevisionsOperations, LazySessionRevisionsOptions } from "../../ILazyRevisionsOperations.js";
import { DocumentSession } from "../../DocumentSession.js";
import { Lazy } from "../../../Lazy.js";
import { GetRevisionOperation } from "../GetRevisionOperation.js";
import { MetadataAsDictionary, MetadataDictionary } from "../../../../Mapping/MetadataAsDictionary.js";
import { SessionRevisionsMetadataOptions } from "../../IRevisionsSessionOperations.js";
import { DocumentType } from "../../../DocumentAbstractions.js";
import { RevisionsCollectionObject } from "../../../../Types/index.js";
import { LazyRevisionOperation } from "./LazyRevisionOperation.js";
import { TypeUtil } from "../../../../Utility/TypeUtil.js";

export class LazyRevisionOperations implements ILazyRevisionsOperations {

    protected readonly delegate: DocumentSession;

    constructor(delegate: DocumentSession) {
        this.delegate = delegate;
    }

    getMetadataFor(id: string): Lazy<MetadataAsDictionary[]>;
    getMetadataFor(id: string, options: SessionRevisionsMetadataOptions): Lazy<MetadataAsDictionary[]>;
    getMetadataFor(id: string, options?: SessionRevisionsMetadataOptions): Lazy<MetadataAsDictionary[]> {
        options = Object.assign({
            pageSize: 25,
            start: 0
        } as SessionRevisionsMetadataOptions, options || {});

        const operation = new GetRevisionOperation(this.delegate, id, options.start, options.pageSize);
        const lazyRevisionOperation = new LazyRevisionOperation(MetadataDictionary, operation, "ListOfMetadata");
        return this.delegate.addLazyOperation(lazyRevisionOperation);
    }

    public get<TEntity extends object>(id: string, date: Date): Lazy<TEntity | null>;
    public get<TEntity extends object>(changeVector: string): Lazy<TEntity | null>;
    public get<TEntity extends object>(changeVector: string,
                                             documentType: DocumentType<TEntity>): Lazy<TEntity | null>;
    public get<TEntity extends object>(changeVectors: string[])
        : Lazy<RevisionsCollectionObject<TEntity>>;
    public get<TEntity extends object>(changeVectors: string[], documentType: DocumentType<TEntity>)
        : Lazy<RevisionsCollectionObject<TEntity>>;
    public get<TEntity extends object>(
        changeVectorOrVectorsOrId: string | string[],
        documentTypeOrDate?: DocumentType<TEntity> | Date)
        : Lazy<RevisionsCollectionObject<TEntity> | TEntity | null> {
        const documentType = TypeUtil.isDocumentType(documentTypeOrDate)
            ? documentTypeOrDate as DocumentType<TEntity>
            : undefined;

        if (TypeUtil.isDate(documentTypeOrDate)) {
            return this._getByIdAndDate(
                changeVectorOrVectorsOrId as string, documentTypeOrDate);
        } else {
            return this._get(changeVectorOrVectorsOrId, documentType);
        }
    }

    private _get<TEntity extends object>(changeVectorOrVectors: string | string[],
                                               documentType?: DocumentType<TEntity>)
        : Lazy<RevisionsCollectionObject<TEntity> | TEntity> {
        if (TypeUtil.isArray(changeVectorOrVectors)) {
            const operation = new GetRevisionOperation(this.delegate, changeVectorOrVectors);
            const lazyRevisionOperation = new LazyRevisionOperation(documentType, operation, "Map");
            return this.delegate.addLazyOperation(lazyRevisionOperation);
        } else {
            const operation = new GetRevisionOperation(this.delegate, changeVectorOrVectors);
            const lazyRevisionOperation = new LazyRevisionOperation(documentType, operation, "Single");
            return this.delegate.addLazyOperation(lazyRevisionOperation);
        }

    }

    private _getByIdAndDate<TEntity extends object>(id: string, date: Date, clazz?: DocumentType<TEntity>): Lazy<TEntity | null> {
        const operation = new GetRevisionOperation(this.delegate, id, date);
        const lazyRevisionOperation = new LazyRevisionOperation<TEntity>(clazz, operation, "Single");
        return this.delegate.addLazyOperation(lazyRevisionOperation);
    }

    public getFor<TEntity extends object>(id: string): Lazy<TEntity[]>;
    public getFor<TEntity extends object>(
        id: string, options: LazySessionRevisionsOptions<TEntity>): Lazy<TEntity[]>;
    public getFor<TEntity extends object>(
        id: string, options: LazySessionRevisionsOptions<TEntity> = {}): Lazy<TEntity[]> {

        const start = options.start ?? 0;
        const pageSize = options.pageSize ?? 25;
        const operation = new GetRevisionOperation(this.delegate, id, start, pageSize);
        const lazyRevisionOperation = new LazyRevisionOperation(options.documentType, operation, "Multi");
        return this.delegate.addLazyOperation(lazyRevisionOperation);
    }
}