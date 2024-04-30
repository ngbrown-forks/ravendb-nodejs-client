import { ObjectLiteralDescriptor, EntityConstructor } from "../Types/index.js";

export type DocumentType<T extends object = object> =
    EntityConstructor<T> | ObjectLiteralDescriptor<T> | string;
