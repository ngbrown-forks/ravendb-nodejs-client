import { ObjectTypeDescriptor } from "../../Types/index.js";


export interface IHiLoIdGenerator {
    generateNextIdFor(database: string, collectionName: string): Promise<number>;
    generateNextIdFor(database: string, documentType: ObjectTypeDescriptor): Promise<number>;
    generateNextIdFor(database: string, entity: object): Promise<number>;
    generateDocumentId(database: string, entity: object): Promise<string>;
}
