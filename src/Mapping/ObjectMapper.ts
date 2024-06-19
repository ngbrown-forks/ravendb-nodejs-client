import { ObjectTypeDescriptor, ObjectLiteralDescriptor, EntityConstructor } from "../Types/index.js";
import { throwError } from "../Exceptions/index.js";
import { TypeUtil } from "../Utility/TypeUtil.js";
import { getLogger } from "../Utility/LogUtil.js";
import { DocumentConventions } from "../Documents/Conventions/DocumentConventions.js";
import { ObjectUtil } from "../Utility/ObjectUtil.js";
import { CONSTANTS } from "../Constants.js";

const log = getLogger({ module: "ObjectMapper" });

export interface TypeInfo {
    typeName?: string;
    nestedTypes?: NestedTypes;
}

export interface NestedTypes {
    [propertyPath: string]: string;
}

export interface ITypesAwareObjectMapper {
    fromObjectLiteral<TResult extends object>(rawResult: object, typeInfo?: TypeInfo, knownTypes?: Map<string, ObjectTypeDescriptor>): TResult;

    toObjectLiteral<TFrom extends object>(obj: TFrom,
                                          typeInfoCallback?: (typeInfo: TypeInfo) => void,
                                          knownTypes?: Map<string, ObjectTypeDescriptor>
    ): object;
}

export class TypesAwareObjectMapper implements ITypesAwareObjectMapper {

    private _dateFormat: string;
    private _throwMappingErrors: boolean = false;
    private _conventions: DocumentConventions;

    public constructor(opts?: TypesAwareJsonObjectMapperOptions) {
        if (opts) {
            this._dateFormat = opts.dateFormat;

            if (!opts.documentConventions) {
                throwError("InvalidArgumentException", "Document conventions cannot be empty.");
            }

            this._conventions = opts.documentConventions;
        }
    }

    public get throwMappingErrors(): boolean {
        return this._throwMappingErrors;
    }

    public set throwMappingErrors(value: boolean) {
        this._throwMappingErrors = value;
    }

    public fromObjectLiteral<TResult extends object>(
        rawResult: object, typeInfo?: TypeInfo, knownTypes?: Map<string, ObjectTypeDescriptor>): TResult {

        rawResult = ObjectUtil.deepLiteralClone(rawResult);
        const typeName = typeInfo ? typeInfo.typeName : null;
        const nestedTypes = typeInfo ? typeInfo.nestedTypes : null;
        const types = knownTypes || this._conventions.knownEntityTypesByName;
        const ctorOrTypeDescriptor = this._getKnownType(typeName, types);
        const result = this._instantiateObject<TResult>(typeName, rawResult, ctorOrTypeDescriptor);

        this._applyNestedTypes(result, nestedTypes, types);

        return result;
    }

    private _applyNestedTypes<TResult extends object>(
        obj: TResult, nestedTypes?: NestedTypes, knownTypes?: Map<string, ObjectTypeDescriptor>) {
        if (!nestedTypes || Object.keys(nestedTypes).length === 0) {
            return obj;
        }

        const nestedTypesKeys = Object.keys(nestedTypes);
        nestedTypesKeys.sort();
        for (const propertyPath of nestedTypesKeys) {
            const typeName = nestedTypes[propertyPath];
            const objPathSegments = propertyPath
                .replace(/\[/g, "![")
                .replace(/\$MAP/g, "!$MAP")
                .replace(/\$SET/g, "!$SET")
                .split(/[!.]/g);
            const fieldContext = this._getFieldContext(obj, objPathSegments);
            const fieldContexts = Array.isArray(fieldContext) ? fieldContext : [fieldContext];
            for (const [i, c] of fieldContexts.entries()) {
                this._applyTypeToNestedProperty(typeName, c, knownTypes);
            }
        }

        return obj;
    }

    public toObjectLiteral<TFrom extends object>(
        obj: TFrom,
        typeInfoCallback?: (typeInfo: TypeInfo) => void,
        knownTypes?: Map<string, ObjectTypeDescriptor>): object {

        const types = (knownTypes || this._conventions.knownEntityTypesByName);

        let nestedTypes: NestedTypes;
        const result = this._makeObjectLiteral(obj, null, (nestedType) => {
            nestedTypes = Object.assign(nestedTypes || {}, nestedType);
        }, Array.from(types.values()));

        let typeName;
        if (TypeUtil.isClass(obj)) {
            typeName = obj.constructor.name;
        } else {
            const typeDescriptor = TypeUtil.findType(obj, Array.from(types.values()));
            typeName = typeDescriptor ? typeDescriptor.name : null;
        }

        const typeInfo: TypeInfo = {};
        typeInfo.typeName = typeName || null;
        typeInfo.nestedTypes = nestedTypes || {};

        if (typeInfoCallback) {
            typeInfoCallback(typeInfo);
        }

        return result;
    }

    private _getFieldContext(parent: object, objPath: string[])
        : ObjectPropertyContext | ObjectPropertyContext[] {
        
        if (!parent) {
            return null;
        }
        
        // eslint-disable-next-line prefer-const
        let [field, ...fieldsPathTail] = objPath;

        const isFieldArray = field.endsWith("[]");
        if (isFieldArray) {
            field = field.replace(/\[\]$/g, "");
        }

        const isFieldSet = field.endsWith("$SET");
        if (isFieldSet) {
            field = field.replace(/\$SET$/g, "");
        }

        const isFieldMap = field.endsWith("$MAP");
        if (isFieldMap) {
            field = field.replace(/\$MAP$/g, "");
        }

        const fieldNameConvention = this._conventions.serverToLocalFieldNameConverter;
        if (fieldNameConvention) {
            field = fieldNameConvention(field);
        }

        let fieldVal = parent[field];
        // eslint-disable-next-line no-prototype-builtins
        if (!parent.hasOwnProperty(field)) {
            if (isFieldArray || isFieldSet || isFieldMap) {
                fieldVal = parent;
            } else {
                return null;
            }
        }

        if (isFieldArray) {
            return this._getFieldContextsForArrayElements(fieldVal, fieldsPathTail);
        }

        if (isFieldSet) {
            return this._getFieldContextsForSetElements(fieldVal as Set<any>, fieldsPathTail);
        }

        if (isFieldMap) {
            return this._getFieldContextsForMapEntries(fieldVal as Map<any, any>, fieldsPathTail);
        }

        if (fieldsPathTail.length) {
            return this._getFieldContext(parent[field], fieldsPathTail);
        }

        return {
            parent,
            field,
            getValue() {
                return parent[field];
            },
            setValue(val) {
                parent[field] = val;
            }
        };
    }

    private _getFieldContextsForMapEntries(mapFieldVal: Map<string, any>, fieldsPathTail: string[]) {
        const result = Array.from(mapFieldVal.entries()).map(([key, val]) => {
            if (!fieldsPathTail.length) {
                return {
                    parent: mapFieldVal,
                    field: key,
                    getValue: () => val,
                    setValue: (newVal) => {
                        mapFieldVal.set(key, newVal);
                    }
                };
            } else {
                return this._getFieldContext(val, fieldsPathTail);
            }
        });

        return this._flattenFieldContexts(result);
    }

    private _getFieldContextsForSetElements(setFieldVal: Set<any>, fieldsPathTail: string[]) {
        const result = Array.from(setFieldVal).map(x => {
            if (!fieldsPathTail.length) {
                return {
                    parent: setFieldVal,
                    field: x,
                    getValue: () => x,
                    setValue: (val) => {
                        setFieldVal.delete(x);
                        setFieldVal.add(val);
                    }
                };
            } else {
                return this._getFieldContext(x, fieldsPathTail);
            }
        });

        return this._flattenFieldContexts(result);
    }

    private _getFieldContextsForArrayElements(fieldVal, fieldsPathTail) {
        const result = (fieldVal as any[]).map((x, i) => {
            if (x === null) {
                return null;
            }

            if (!fieldsPathTail.length) {
                return {
                    parent: fieldVal,
                    field: i.toString(),
                    getValue() {
                        return fieldVal[i];
                    },
                    setValue(val) {
                        fieldVal[i] = val;
                    }
                };
            } else {
                return this._getFieldContext(x, fieldsPathTail);
            }
        });

        return this._flattenFieldContexts(result);
    }

    private _flattenFieldContexts(
        arr: (ObjectPropertyContext[] | ObjectPropertyContext)[]): ObjectPropertyContext[] {
        return arr.reduce((result: any, next) => {
            if (Array.isArray(next)) {
                return result.concat(next as ObjectPropertyContext[]);
            }

            result.push(next as ObjectPropertyContext);
            return result;
        }, [] as ObjectPropertyContext[]);
    }

    private _applyTypeToNestedProperty(
        fieldTypeName: string, fieldContext: ObjectPropertyContext, knownTypes: Map<string, ObjectTypeDescriptor>) {
        let parent: object;
        let field: string;

        if (fieldContext) {
            ({ parent, field } = fieldContext);
        }

        if (typeof parent === "undefined") {
            return;
        }

        const fieldVal = fieldContext.getValue();
        if (typeof fieldVal === "undefined") {
            return;
        }

        if (fieldVal === null) {
            fieldContext.setValue(null);
            return;
        }

        if (fieldTypeName === "date") {
            fieldContext.setValue(this._conventions.dateUtil.parse(fieldVal));
            return;
        }

        if (fieldTypeName === "Set") {
            fieldContext.setValue(new Set(fieldVal));
            return;
        }

        if (fieldTypeName === "Map") {
            const map = new Map(fieldVal);
            fieldContext.setValue(map);
            return;
        }

        if (Array.isArray(fieldVal)) {
            for (const [i, item] of fieldVal.entries()) {
                this._applyTypeToNestedProperty(fieldTypeName, {
                    field: i.toString(),
                    parent: fieldVal,
                    getValue: () => fieldVal[i],
                    setValue: (val) => fieldVal[i] = val
                }, knownTypes);
            }

            return;
        }

        const ctorOrTypeDescriptor = this._getKnownType(fieldTypeName, knownTypes);
        const instance = this._instantiateObject(fieldTypeName, fieldVal, ctorOrTypeDescriptor);
        fieldContext.setValue(instance);
    }

    private _instantiateObject<TResult>(
        typeName: string, rawValue: object, ctorOrTypeDescriptor: ObjectTypeDescriptor): TResult {
        let instance = null;
        if (!ctorOrTypeDescriptor) {
            instance = Object.assign({}, rawValue);
        } else if (TypeUtil.isClass(ctorOrTypeDescriptor)) {
            instance = this.createEmptyObject(ctorOrTypeDescriptor, rawValue);
        } else if (TypeUtil.isObjectLiteralTypeDescriptor(ctorOrTypeDescriptor)) {
            instance = (ctorOrTypeDescriptor as ObjectLiteralDescriptor).construct(rawValue);
        } else {
            throwError("InvalidArgumentException",
                `Invalid type descriptor for type ${typeName}: ${ctorOrTypeDescriptor}`);
        }

        return instance as TResult;
    }

    private _getKnownType(typeName: string, knownTypes: Map<string, ObjectTypeDescriptor>): ObjectTypeDescriptor {
        if (!typeName) {
            return null;
        }

        const ctorOrTypeDescriptor = knownTypes.get(typeName);
        if (!ctorOrTypeDescriptor) {
            if (this._throwMappingErrors) {
                throwError("MappingError", `Could not find type descriptor '${typeName}'.`);
            } else {
                log.warn(`Could not find type descriptor '${typeName}'.`);
            }
        }

        return ctorOrTypeDescriptor;
    }

    protected createEmptyObject<TResult extends object>(ctor: EntityConstructor<TResult>, rawValue: object) {
        if (!ctor) {
            throwError("InvalidArgumentException", "ctor argument must not be null or undefined.");
        }

        return Object.assign(new ctor(), rawValue) as TResult;
    }

    private _makeObjectLiteral(
        obj: object,
        objPathPrefix: string,
        typeInfoCallback: (types: NestedTypes) => void,
        knownTypes: ObjectTypeDescriptor[],
        skipTypes: boolean = false): any {

        if (TypeUtil.isDate(obj)) {
            if (!skipTypes) {
                typeInfoCallback({
                    [objPathPrefix]: "date"
                });
            }

            return this._conventions.dateUtil.stringify(obj as Date);
        }

        if (TypeUtil.isSet(obj)) {
            if (!skipTypes) {
                typeInfoCallback({
                    [objPathPrefix]: "Set"
                });
            }

            const newObjPathPrefix = `${objPathPrefix}$SET`;
            return Array.from((obj as Set<any>))
                .map(x => this._makeObjectLiteral(x, newObjPathPrefix, typeInfoCallback, knownTypes));
        }

        if (TypeUtil.isMap(obj)) {
            if (!skipTypes) {
                typeInfoCallback({
                    [objPathPrefix]: "Map"
                });
            }

            const valuePathPrefix = `${objPathPrefix}$MAP`;
            const map = obj as Map<any, any>;
            return Array.from(map.entries()).reduce((result, [ name, value ]) => {
                return [
                    ...result,
                    [
                        this._makeObjectLiteral(name, valuePathPrefix + "KEY", typeInfoCallback, knownTypes),
                        this._makeObjectLiteral(value, valuePathPrefix, typeInfoCallback, knownTypes)
                    ]
                ];
            }, []);
        }

        if (Array.isArray(obj)) {
            return obj.map((x, index) => this._makeObjectLiteral(x, `${objPathPrefix}.${index}`, typeInfoCallback, knownTypes));
        }

        if (TypeUtil.isObject(obj)) {
            if (objPathPrefix) { // if it's non-root object
                const matchedType = TypeUtil.findType(obj, knownTypes);
                if (!skipTypes
                    && matchedType
                    && matchedType.name !== "Function") {
                    typeInfoCallback({ [objPathPrefix]: matchedType.name });
                }
            }

            return Object.keys(obj)
                .reduce((result, key) => {
                    let nestedTypeInfoKey = key;
                    if (this._conventions.localToServerFieldNameConverter) {
                        nestedTypeInfoKey = this._conventions.localToServerFieldNameConverter(key);
                    }

                    let innerSkipTypes = skipTypes
                    if (!skipTypes) {
                        innerSkipTypes = key === CONSTANTS.Documents.Metadata.KEY;
                    }

                    const fullPath = objPathPrefix ? `${objPathPrefix}.${nestedTypeInfoKey}` : nestedTypeInfoKey;
                    result[key] = this._makeObjectLiteral(obj[key], fullPath, typeInfoCallback, knownTypes, innerSkipTypes);
                    return result;
                }, {});
        }

        return obj;
    }
}

export interface TypesAwareJsonObjectMapperOptions {
    dateFormat?: string;
    documentConventions?: DocumentConventions;
}

interface ObjectPropertyContext {
    parent: any;
    field: string;

    getValue(): any;

    setValue(val: any): void;
}
