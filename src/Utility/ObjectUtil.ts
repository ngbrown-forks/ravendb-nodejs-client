import { TypeUtil } from "./TypeUtil.js";
import { DocumentConventions } from "../Documents/Conventions/DocumentConventions.js";
import { CONSTANTS } from "../Constants.js";
import { MetadataObject } from "../Documents/Session/MetadataObject.js";
import { CompareExchangeResultItem } from "../Documents/Operations/CompareExchange/CompareExchangeValueResultParser.js";
import { ServerCasing, ServerResponse } from "../Types/index.js";
import { TimeSeriesRangeResult } from "../Documents/Operations/TimeSeries/TimeSeriesRangeResult.js";
import { TimeSeriesEntry } from "../Documents/Session/TimeSeries/TimeSeriesEntry.js";
import { CounterDetail } from "../Documents/Operations/Counters/CounterDetail.js";
import { AttachmentDetails } from "../Documents/Attachments/index.js";

function iden(x, locale) {
    return x;
}

export class ObjectUtil {

    // WARNING: some methods are assigned below dynamically

    static camelCase = (input: string, locale?: string) => locale ? input[0].toLocaleUpperCase(locale)  + input.slice(1) : input[0].toLowerCase() + input.slice(1);
    static camel = ObjectUtil.camelCase;
    static pascalCase = (input: string, locale?: string) => locale ? input[0].toLocaleLowerCase(locale) + input.slice(1) : input[0].toUpperCase() + input.slice(1);
    static pascal = ObjectUtil.pascalCase;

    public static deepJsonClone(o) {
        return JSON.parse(JSON.stringify(o));
    }

    public static deepLiteralClone(item) {
        if (!item) {
            return item;
        }

        let result;

        if (Array.isArray(item)) {
            result = [];
            for (let index = 0; index < item.length; index++) {
                result[index] = ObjectUtil.deepLiteralClone(item[index]);
            }
        } else if (TypeUtil.isObject(item)) {
            result = {};
            for (const prop in item) {
                result[prop] = ObjectUtil.deepLiteralClone(item[prop]);
            }
        } else {
            result = item;
        }

        return result;
    }

    public static mapToLiteral<TValue>(input: Map<string, TValue>): { [key: string]: TValue };
    public static mapToLiteral<TValue, TResult>(
        input: Map<string, TValue>,
        valueTransformFunc: (value: string, key: TValue) => TResult): { [key: string]: TResult };
    public static mapToLiteral<TValue, TResult>(
        input: Map<string, TValue>,
        valueTransformFunc?: (value: string, key: TValue) => TResult)
        : { [key: string]: TResult } {
        return Array.from(input.entries())
            .reduce((obj, [key, value]) => (
                Object.assign(obj, {
                    [key]: valueTransformFunc
                        ? valueTransformFunc(key, value)
                        : value
                })
            ), {});
    }

    public static transformObjectKeys(
        obj: object, opts?: ObjectChangeCaseOptions): object {
        const options: any = setDefaults(opts, DEFAULT_CHANGE_CASE_OPTIONS);
        return transformObjectKeys(obj, options, []);
    }

    public static transformDocumentKeys(obj: any, conventions: DocumentConventions) {
        if (!obj) {
            return obj;
        }
        const metadata = obj[CONSTANTS.Documents.Metadata.KEY];
        const hasMetadata = CONSTANTS.Documents.Metadata.KEY in obj;
        const transformedMetadata = hasMetadata ? ObjectUtil.transformMetadataKeys(metadata, conventions) : null;

        if (!conventions.serverToLocalFieldNameConverter) {
            // fast path - no need to transform entity - transform metadata only
            if (hasMetadata) {
                return {
                    ...obj,
                    [CONSTANTS.Documents.Metadata.KEY]: transformedMetadata
                };
            } else {
                return obj;
            }
        }

        const transformed = ObjectUtil.transformObjectKeys(obj, {
            defaultTransform: conventions.serverToLocalFieldNameConverter
        });

        if (hasMetadata) {
            transformed[CONSTANTS.Documents.Metadata.KEY] = transformedMetadata;
        }

        return transformed;
    }

    public static transformMetadataKeys(metadata: MetadataObject, conventions: DocumentConventions) {
        if (!metadata) {
            return metadata;
        }

        let result: MetadataObject = {};

        const userMetadataFieldsToTransform: any = {};
        const needsCaseTransformation = !!conventions.serverToLocalFieldNameConverter;

        for (const [key, value] of Object.entries(metadata)) {
            if (key === CONSTANTS.Documents.Metadata.ATTACHMENTS) {
                result[CONSTANTS.Documents.Metadata.ATTACHMENTS] = value ? value.map(x => ObjectUtil.mapAttachmentDetailsToLocalObject(x)) : null
            } else if (key[0] === "@" || key === "Raven-Node-Type") {
                result[key] = value;
            } else {
                if (needsCaseTransformation) {
                    userMetadataFieldsToTransform[key] = value;
                } else {
                    result[key] = value;
                }
            }
        }

        if (Object.keys(userMetadataFieldsToTransform)) {
            const transformedUserFields = ObjectUtil.transformObjectKeys(userMetadataFieldsToTransform, {
                defaultTransform: conventions.serverToLocalFieldNameConverter
            });

            result = Object.assign(result, transformedUserFields);
        }

        return result;
    }

    public static mapAttachmentDetailsToLocalObject(json: any): AttachmentDetails {
        return {
            changeVector: json.ChangeVector,
            contentType: json.ContentType,
            documentId: json.DocumentId,
            hash: json.Hash,
            name: json.Name,
            size: json.Size
        };
    }

    public static mapIncludesToLocalObject(json: any, conventions: DocumentConventions) {
        const mappedIncludes: Record<string, any> = {};
        if (json) {
            for (const [key, value] of Object.entries(json)) {
                mappedIncludes[key] = ObjectUtil.transformDocumentKeys(value, conventions);
            }
        }
        return mappedIncludes;
    }

    public static mapCompareExchangeToLocalObject(json: Record<string, any>) {
        if (!json) {
            return undefined;
        }

        const result: Record<string, CompareExchangeResultItem> = {};

        for (const [key, value] of Object.entries(json)) {
            result[key] = {
                index: value.Index,
                key: value.Key,
                changeVector: value.ChangeVector,
                value: {
                    Object: value.Value?.Object
                }
            }
        }

        return result;
    }

    public static mapTimeSeriesIncludesToLocalObject(json: ServerCasing<ServerResponse<TimeSeriesRangeResult>>) {
        if (!json) {
            return undefined;
        }

        const result: Record<string, Record<string, ServerResponse<TimeSeriesRangeResult>[]>> = {};

        for (const [docId, perDocumentTimeSeries] of Object.entries(json)) {
            const perDocumentResult: Record<string, ServerResponse<TimeSeriesRangeResult>[]> = {};

            for (const [tsName, tsData] of Object.entries(perDocumentTimeSeries)) {
                perDocumentResult[tsName] = (tsData as any).map(ts => {
                    return {
                        from: ts.From,
                        to: ts.To,
                        includes: ts.Includes,
                        totalResults: ts.TotalResults,
                        entries: ts.Entries.map(entry => ({
                            timestamp: entry.Timestamp,
                            isRollup: entry.IsRollup,
                            tag: entry.Tag,
                            values: entry.Values,
                        } as ServerResponse<TimeSeriesEntry>))
                    };
                })
            }

            result[docId] = perDocumentResult;
        }

        return result;
    }

    public static mapCounterIncludesToLocalObject(json: object) {
        const result: Record<string, CounterDetail[]> = json ? {} : undefined;

        if (json) {
            for (const [key, value] of Object.entries(json)) {
                result[key] = value.map(c => {
                    return c ? {
                        changeVector: c.ChangeVector,
                        counterName: c.CounterName,
                        counterValues: c.CounterValues,
                        documentId: c.DocumentId,
                        etag: c.Etag,
                        totalValue: c.TotalValue
                    } : null;
                });
            }
        }

        return result;
    }

}

/*
    This code is a modified version of https://github.com/claudetech/js-change-object-case
*/

//TODO: review those methods

export type FieldNameConversion = (fieldName: string) => string;

export interface ObjectChangeCaseOptionsBase {
    recursive?: boolean;
    arrayRecursive?: boolean;
    ignoreKeys?: (string | RegExp)[];
    ignorePaths?: (string | RegExp)[];
    paths?: { transform: FieldNameConversion, path?: RegExp }[];
}

export interface ObjectChangeCaseOptions extends ObjectChangeCaseOptionsBase {
    defaultTransform: FieldNameConversion;
}

interface InternalObjectChangeCaseOptions extends ObjectChangeCaseOptions {
    throwOnDuplicate: boolean;
    locale: string;
}

const DEFAULT_CHANGE_CASE_OPTIONS = {
    recursive: true,
    arrayRecursive: true,
    throwOnDuplicate: false,
    locale: null,
    ignoreKeys: [],
    ignorePaths: [],
};

function setDefaults(object, defaults) {
    object = object || {};
    for (const i in defaults) {
        // eslint-disable-next-line no-prototype-builtins
        if (defaults.hasOwnProperty(i) && typeof object[i] === "undefined") {
            object[i] = defaults[i];
        }
    }
    return object;
}

function isObject(value: any) {
    if (!value) {
        return false;
    }
    return typeof value === "object" || typeof value === "function";
}

function isArray(value: any): value is Array<any> {
    return Array.isArray(value);
}

function computeNewValue(value, options, forceRecurse: boolean, stack: string[]) {
    const valueIsArray = isArray(value);
    if (valueIsArray && options.arrayRecursive) {
        return transformArray(value, options, stack);
    } else if (isObject(value) && !valueIsArray && (options.recursive || forceRecurse)) {
        return transformObjectKeys(value, options, stack);
    } else {
        return value;
    }
}

function transformArray(array: any[], options: ObjectChangeCaseOptions, stack) {
    if (!isArray(array)) {
        throw new Error("transformArray expects an array");
    }
    const result = [];
    stack = [...stack, "[]"];

    for (const value of array) {
        const newValue = computeNewValue(value, options, true, stack);
        result.push(newValue);
    }
    stack.pop();
    return result;
}

function makeKeyPath(keyStack: string[]) {
    return keyStack.join(".");
}

function shouldTransformKey(currentKey: string, currentPath: string, opts) {
    for (const x of opts.ignoreKeys) {
        if ("test" in x ? x.test(currentKey) : x === currentKey) {
            return false;
        }
    }

    if (opts.ignorePaths) {
        const currentPathPlusKey = currentPath ? currentPath + "." + currentKey : currentKey;

        for (const x of opts.ignorePaths) {
            if ("test" in x ? x.test(currentPathPlusKey) : x === currentPathPlusKey) {
                return false;
            }
        }
    }

    return true;
}

function getTransformFunc(key, currentPath, opts: InternalObjectChangeCaseOptions) {
    if (opts.paths) {
        for (const p of opts.paths) {
            if (!p.path) {
                return p.transform;
            } else if (p.path.test(currentPath)) {
                return p.transform ?? iden;
            }
        }
    }

    return opts.defaultTransform ?? iden;
}

function transformObjectKeys(object: any, options: InternalObjectChangeCaseOptions, stack: string[]) {
    if (!object) {
        return object;
    }

    const result = {};
    for (const key in object) {
        // eslint-disable-next-line no-prototype-builtins
        if (object.hasOwnProperty(key)) {
            const value = object[key];
            let newKey = key;
            const currentPath = makeKeyPath(stack);
            if (shouldTransformKey(key, currentPath, options)) {
                const f = getTransformFunc(key, currentPath, options);
                newKey = f(key, options.locale ?? undefined);
            }

            // eslint-disable-next-line no-prototype-builtins
            if (result.hasOwnProperty(newKey) && options.throwOnDuplicate) {
                throw new Error("duplicated key " + newKey);
            }

            stack = [...stack, newKey];
            result[newKey] = computeNewValue(value, options, false, stack);
            stack.pop();
        }
    }
    return result;
}

