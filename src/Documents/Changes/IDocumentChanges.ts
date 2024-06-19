import { IChangesObservable } from "./IChangesObservable.js";
import { ObjectTypeDescriptor } from "../../Types/index.js";


export interface IDocumentChanges<TChange> {
    /**
     * Subscribe to changes for specified document only.
     */
    forDocument(docId: string): IChangesObservable<TChange>;

    /**
     * Subscribe to changes for all documents.
     */
    forAllDocuments(): IChangesObservable<TChange>;

    /**
     * Subscribe to changes for all documents that Id starts with given prefix.
     */
    forDocumentsStartingWith(docIdPrefix: string): IChangesObservable<TChange>;

    /**
     * Subscribe to changes for all documents that belong to specified collection (Raven-Entity-Name).
     */
    forDocumentsInCollection(collectionName: string): IChangesObservable<TChange>;

    /**
     * Subscribe to changes for all documents that belong to specified collection (Raven-Entity-Name).
     */
    forDocumentsInCollection<T extends object>(type: ObjectTypeDescriptor<T>): IChangesObservable<TChange>;
}