import { InMemoryDocumentSessionOperations } from "../InMemoryDocumentSessionOperations.js";
import { GetRevisionsCommand } from "../../Commands/GetRevisionsCommand.js";
import { throwError } from "../../../Exceptions/index.js";
import { TypeUtil } from "../../../Utility/TypeUtil.js";
import { IRavenArrayResult, IRavenObject, RevisionsCollectionObject } from "../../../Types/index.js";
import { DocumentInfo } from "../DocumentInfo.js";
import { MetadataAsDictionary } from "../../../Mapping/MetadataAsDictionary.js";
import { CONSTANTS } from "../../../Constants.js";
import { DocumentType } from "../../DocumentAbstractions.js";
import { IMetadataDictionary } from "../IMetadataDictionary.js";

export class GetRevisionOperation {

    private readonly _session: InMemoryDocumentSessionOperations;

    private _result: IRavenArrayResult;
    private readonly _command: GetRevisionsCommand;

    public constructor(session: InMemoryDocumentSessionOperations, id: string, before: Date);
    public constructor(session: InMemoryDocumentSessionOperations, id: string, start: number, pageSize: number);
    public constructor(session: InMemoryDocumentSessionOperations, id: string, start: number, pageSize: number,
                       metadataOnly: boolean);
    public constructor(session: InMemoryDocumentSessionOperations, changeVector: string);
    public constructor(session: InMemoryDocumentSessionOperations, changeVectors: string[]);
    public constructor(session: InMemoryDocumentSessionOperations, changeVectorOrChangeVectorsOrId: string | string[],
                       startOrDate?: Date | number, pageSize?: number, metadataOnly: boolean = false) {
        if (!session) {
            throwError("InvalidArgumentException", "Session cannot be null.");
        }

        if (!changeVectorOrChangeVectorsOrId) {
            throwError("InvalidArgumentException", "Id cannot be null.");
        }

        this._session = session;
        if (startOrDate instanceof Date) {
            this._command = new GetRevisionsCommand(session.conventions,
                changeVectorOrChangeVectorsOrId as string, startOrDate);
        } else if (TypeUtil.isArray(changeVectorOrChangeVectorsOrId)) {
            this._command = new GetRevisionsCommand(session.conventions, changeVectorOrChangeVectorsOrId);
        } else if (TypeUtil.isNumber(startOrDate)) {
            this._command = new GetRevisionsCommand(session.conventions, changeVectorOrChangeVectorsOrId, startOrDate,
                pageSize, metadataOnly);
        } else {
            this._command = new GetRevisionsCommand(session.conventions, changeVectorOrChangeVectorsOrId);
        }
    }

    public createRequest() {
        if (this._command.changeVectors) {
            return this._session.checkIfAllChangeVectorsAreAlreadyIncluded(this._command.changeVectors) ? null : this._command;
        }

        if (this._command.changeVector) {
            return this._session.checkIfAllChangeVectorsAreAlreadyIncluded([this.command.changeVector]) ? null : this._command;
        }

        if (this.command.before) {
            return this._session.checkIfRevisionByDateTimeBeforeAlreadyIncluded(this.command.id, this.command.before) ? null : this._command;
        }

        return this._command;
    }

    set result(result: IRavenArrayResult) {
        this._result = result;
    }

    public get command() {
        return this._command;
    }

    private _getRevision<TEntity extends object>(documentType: DocumentType<TEntity>, document: IRavenObject): TEntity {
        if (!document) {
            return null;
        }

        let id: string = null;

        const metadata = document[CONSTANTS.Documents.Metadata.KEY];
        if (metadata) {
            id = metadata[CONSTANTS.Documents.Metadata.ID];
        }

        let changeVector = null as string;
        if (metadata) {
            changeVector = metadata[CONSTANTS.Documents.Metadata.CHANGE_VECTOR];
        }

        const entity = this._session.entityToJson.convertToEntity(documentType, id, document, !this._session.noTracking) as any as TEntity;
        const documentInfo = new DocumentInfo();
        documentInfo.id = id;
        documentInfo.changeVector = changeVector;
        documentInfo.document = document;
        documentInfo.metadata = metadata;
        documentInfo.entity = entity;
        this._session.documentsByEntity.put(entity, documentInfo);

        this._session.onAfterConversionToEntityInvoke(id, document, entity);

        return entity;
    }

    public getRevisionsFor<TEntity extends object>(documentType: DocumentType<TEntity>): TEntity[] {
        const resultsCount = this._result.results.length;
        const results = [] as TEntity[];

        for (const document of this._result.results) {
            results.push(this._getRevision<TEntity>(documentType, document));
        }
        return results;
    }

    public getRevisionsMetadataFor(): IMetadataDictionary[] {
        const resultsCount = this._result.results.length;
        const results = [] as MetadataAsDictionary[];

        for (const document of this._result.results) {
            const metadata = document[CONSTANTS.Documents.Metadata.KEY];
            results.push(metadata);
        }

        return results;
    }

    public getRevision<TEntity extends object>(documentType: DocumentType<TEntity>): TEntity | null {
        if (!this._result) {

            let revision: DocumentInfo;

            if (this._command.changeVectors) {
                for (const changeVector of this._command.changeVectors) {
                    revision = this._session.includeRevisionsByChangeVector.get(changeVector);
                    if (revision) {
                        return this._getRevision(documentType, revision.document);
                    }
                }
            }

            if (this.command.changeVector && this._session.includeRevisionsByChangeVector) {
                revision = this._session.includeRevisionsByChangeVector.get(this._command.changeVector);
                if (revision) {
                    return this._getRevision(documentType, revision.document);
                }
            }

            if (this._command.before && this._session.includeRevisionsIdByDateTimeBefore) {
                const dictionaryDateTimeToDocument = this._session.includeRevisionsIdByDateTimeBefore.get(this._command.id);

                if (dictionaryDateTimeToDocument) {
                    revision = dictionaryDateTimeToDocument.get(this._command.before.getTime());
                    if (revision) {
                        return this._getRevision(documentType, revision.document);
                    }
                }
            }

            return null;
        }

        const document = this._result.results[0];
        return this._getRevision(documentType, document);
    }

    public getRevisions<TEntity extends object>(
        documentType: DocumentType<TEntity>): RevisionsCollectionObject<TEntity> {
        const results = {} as RevisionsCollectionObject<TEntity>;

        if (!this._result) {
            for (const changeVector of this._command.changeVectors) {
                const revision = this._session.includeRevisionsByChangeVector.get(changeVector);
                if (revision) {
                    results[changeVector] = this._getRevision(documentType, revision.document);
                }
            }

            return results;
        }

        for (let i = 0; i < this._command.changeVectors.length; i++) {
            const changeVector = this._command.changeVectors[i];
            if (!changeVector) {
                continue;
            }

            results[changeVector] = this._getRevision(documentType, this._result.results[i]);
        }

        return results;
    }
}
