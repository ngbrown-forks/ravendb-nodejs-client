import { CompareExchangeValue } from "./CompareExchangeValue.js";
import { ICompareExchangeValue } from "./ICompareExchangeValue.js";
import { CompareExchangeValueState } from "./CompareExchangeValueState.js";
import { throwError } from "../../../Exceptions/index.js";
import { TypeUtil } from "../../../Utility/TypeUtil.js";
import { CompareExchangeResultClass, EntityConstructor } from "../../../Types/index.js";
import { CompareExchangeValueJsonConverter } from "./CompareExchangeValueJsonConverter.js";
import { COMPARE_EXCHANGE, CONSTANTS } from "../../../Constants.js";
import { StringUtil } from "../../../Utility/StringUtil.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { EntityToJson } from "../../Session/EntityToJson.js";
import { ICommandData } from "../../Commands/CommandData.js";
import { PutCompareExchangeCommandData } from "../../Commands/Batches/PutCompareExchangeCommandData.js";
import { DeleteCompareExchangeCommandData } from "../../Commands/Batches/DeleteCompareExchangeCommandData.js";
import { ITypesAwareObjectMapper } from "../../../Mapping/ObjectMapper.js";
import { IMetadataDictionary } from "../../Session/IMetadataDictionary.js";
import { CompareExchangeValueResultParser } from "./CompareExchangeValueResultParser.js";

export class CompareExchangeSessionValue {
    private readonly _key: string;
    private _index: number;
    private _originalValue: CompareExchangeValue<any>;

    private _value: ICompareExchangeValue;
    private _state: CompareExchangeValueState;

    public constructor(key: string, index: number, state: CompareExchangeValueState);
    public constructor(value: CompareExchangeValue<any>);
    public constructor(keyOrValue: string | CompareExchangeValue<object>, index?: number, state?: CompareExchangeValueState) {
        if (!keyOrValue) {
            throwError("InvalidArgumentException", "Key cannot be null");
        }

        if (TypeUtil.isString(keyOrValue)) {
            this._key = keyOrValue;
            this._index = index;
            this._state = state;
        } else {
            this._key = keyOrValue.key;
            this._index = keyOrValue.index;
            this._state = keyOrValue.index >= 0 ? "None" : "Missing";

            if (keyOrValue.index > 0) {
                this._originalValue = keyOrValue;
            }
        }
    }

    public getValue<T>(clazz: CompareExchangeResultClass<T>, conventions: DocumentConventions): CompareExchangeValue<T> {
        switch (this._state) {
            case "None":
            case "Created": {
                if (this._value instanceof CompareExchangeValue) {
                    return this._value;
                }

                if (this._value) {
                    throwError("InvalidOperationException", "Value cannot be null");
                }

                let entity: T;

                if (this._originalValue && !TypeUtil.isNullOrUndefined(this._originalValue.value)) {
                    entity = CompareExchangeValueResultParser.deserializeObject(this._originalValue.value, conventions, clazz);
                }

                const value = new CompareExchangeValue(this._key, this._index, entity, null);
                this._value = value;

                return value;
            }
            case "Missing":
            case "Deleted": {
                return null;
            }
            default: {
                throwError("NotSupportedException", "Not supported state: " + this._state);
            }

        }
    }

    public create<T>(item: T): CompareExchangeValue<T> {
        this._assertState();

        if (this._value) {
            throwError("InvalidOperationException", "The compare exchange value with key '" + this._key + "' is already tracked.");
        }

        this._index = 0;
        const value = new CompareExchangeValue(this._key, this._index, item, null);
        this._value = value;
        this._state = "Created";
        return value;
    }

    public delete(index: number) {
        this._assertState();

        this._index = index;
        this._state = "Deleted";
    }

    private _assertState() {
        switch (this._state) {
            case "None":
            case "Missing": {
                return;
            }
            case "Created": {
                throwError("InvalidOperationException", "The compare exchange value with key '" + this._key + "' was already stored.");
                break;
            }
            case "Deleted": {
                throwError("InvalidOperationException", "The compare exchange value with key '" + this._key + "' was already deleted.");
            }
        }
    }

    public getCommand(conventions: DocumentConventions): ICommandData {
        switch (this._state) {
            case "None":
            case "Created": {
                if (!this._value) {
                    return null;
                }

                const entity = CompareExchangeValueJsonConverter.convertToJson(this._value.value, conventions);

                let entityJson = TypeUtil.isObject(entity) ? entity : null;
                let metadata: any;

                if (this._value.hasMetadata() && Object.keys(this._value.metadata)) {
                    metadata = CompareExchangeSessionValue.prepareMetadataForPut(this._key, this._value.metadata, conventions);
                }

                let entityToInsert = null;
                if (TypeUtil.isNullOrUndefined(entityJson)) {
                    entityJson = entityToInsert = this._convertEntity(this._key, entity, conventions.objectMapper, metadata);
                }

                const newValue = new CompareExchangeValue(this._key, this._index, entityJson, null);
                const hasChanged = TypeUtil.isNullOrUndefined(this._originalValue) || this.hasChanged(this._originalValue, newValue);

                this._originalValue = newValue;

                if (!hasChanged) {
                    return null;
                }

                if (TypeUtil.isNullOrUndefined(entityToInsert)) {
                    entityToInsert = this._convertEntity(this._key, entity, conventions.objectMapper, metadata);
                }

                return new PutCompareExchangeCommandData(newValue.key, entityToInsert, newValue.index);
            }
            case "Deleted": {
                return new DeleteCompareExchangeCommandData(this._key, this._index);
            }
            case "Missing": {
                return null;
            }
            default: {
                throwError("InvalidOperationException", "Not supported state: " + this._state);
            }
        }
    }

    private _convertEntity(key: string, entity: any, objectMapper: ITypesAwareObjectMapper, metadata: any) {
        return {
            [COMPARE_EXCHANGE.OBJECT_FIELD_NAME]: entity,
            [CONSTANTS.Documents.Metadata.KEY]: metadata ?? undefined
        }
    }

    public hasChanged(originalValue: CompareExchangeValue<unknown>, newValue: CompareExchangeValue<unknown>) {
        if (originalValue === newValue) {
            return false;
        }

        if (!StringUtil.equalsIgnoreCase(originalValue.key, newValue.key)) {
            throwError("InvalidOperationException", "Keys do not match. Expected '" + originalValue.key + " but was: " + newValue.key);
        }

        if (originalValue.index !== newValue.index) {
            return true;
        }

        return JSON.stringify(originalValue.value) !== JSON.stringify(newValue.value);
    }

    public updateState(index: number) {
        this._index = index;
        this._state = "None";

        if (this._originalValue) {
            this._originalValue.index = index;
        }

        if (this._value) {
            this._value.index = index;
        }
    }

    public updateValue(value: CompareExchangeValue<object>, mapper: ITypesAwareObjectMapper) {
        this._index = value.index;
        this._state = value.index >= 0 ? "None" : "Missing";

        this._originalValue = value;

        if (this._value) {
            this._value.index = this._index;

            if (!TypeUtil.isNullOrUndefined(this._value.value)) {
                EntityToJson.populateEntity(this._value.value, value.value, mapper);
            }
        }
    }

    public static prepareMetadataForPut(key: string, metadataDictionary: IMetadataDictionary, conventions: DocumentConventions) {
        if (CONSTANTS.Documents.Metadata.EXPIRES in metadataDictionary) {
            const obj = metadataDictionary[CONSTANTS.Documents.Metadata.EXPIRES];
            if (!obj) {
                CompareExchangeSessionValue._throwInvalidExpiresMetadata(
                    "The value of " + CONSTANTS.Documents.Metadata.EXPIRES + " metadata for compare exchange '" + key + " is null.");
            }

            if (!TypeUtil.isDate(obj) && !TypeUtil.isString(obj)) {
                CompareExchangeSessionValue._throwInvalidExpiresMetadata("The class of " + CONSTANTS.Documents.Metadata.EXPIRES + " metadata for compare exchange '" + key + "' is not valid. Use the following type: Date or string");
            }
        }

        return conventions.objectMapper.toObjectLiteral(metadataDictionary);
    }

    private static _throwInvalidExpiresMetadata(message: string) {
        throwError("InvalidArgumentException", message);
    }
}

