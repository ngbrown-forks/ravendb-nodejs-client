import { TransactionMode } from "./TransactionMode.js";
import { throwError } from "../../Exceptions/index.js";
import { CompareExchangeValue } from "../Operations/CompareExchange/CompareExchangeValue.js";
import { CompareExchangeResultClass } from "../../Types/index.js";
import { TypeUtil } from "../../Utility/TypeUtil.js";
import { DocumentSession } from "./DocumentSession.js";
import { CaseInsensitiveKeysMap } from "../../Primitives/CaseInsensitiveKeysMap.js";
import { CompareExchangeSessionValue } from "../Operations/CompareExchange/CompareExchangeSessionValue.js";
import {
    CompareExchangeResultItem,
    CompareExchangeValueResultParser
} from "../Operations/CompareExchange/CompareExchangeValueResultParser.js";
import { GetCompareExchangeValueOperation } from "../Operations/CompareExchange/GetCompareExchangeValueOperation.js";
import { GetCompareExchangeValuesOperation } from "../Operations/CompareExchange/GetCompareExchangeValuesOperation.js";
import { SaveChangesData } from "../Commands/CommandData.js";
import { StringUtil } from "../../Utility/StringUtil.js";
import { COMPARE_EXCHANGE } from "../../Constants.js";

export class StoredCompareExchange {
    public readonly entity: any;

    public readonly index: number;

    public constructor(index: number, entity: any) {
        this.entity = entity;
        this.index = index;
    }
}

export abstract class ClusterTransactionOperationsBase {

    protected readonly _session: DocumentSession;
    private readonly _state = CaseInsensitiveKeysMap.create<CompareExchangeSessionValue>();
    private readonly _compareExchangeIncludes = CaseInsensitiveKeysMap.create<CompareExchangeValue<object>>();

    private _missingDocumentsTooAtomicGuardIndex: Map<string, string>;

    public tryGetMissingAtomicGuardFor(docId: string, changeVectorCallback: (changeVector: string) => void): boolean {
        if (!this._missingDocumentsTooAtomicGuardIndex) {
            changeVectorCallback(null);
            return false;
        }

        const cv = this._missingDocumentsTooAtomicGuardIndex.get(docId);
        changeVectorCallback(cv);
        return cv != null;
    }

    public get numberOfTrackedCompareExchangeValues() {
        return this._state.size;
    }

    protected constructor(session: DocumentSession) {
        if (session.transactionMode !== "ClusterWide" as TransactionMode) {
            throwError(
                "InvalidOperationException",
                "This function is part of cluster transaction session, "
                + "in order to use it you have to open the Session with ClusterWide option.");
        }

        this._session = session;
    }

    public get session() {
        return this._session;
    }

    public isTracked(key: string): boolean {
        return this._tryGetCompareExchangeValueFromSession(key, TypeUtil.NOOP);
    }

    public createCompareExchangeValue<T>(key: string, item: T): CompareExchangeValue<T> {
        if (!key) {
            throwError("InvalidArgumentException", "Key cannot be null");
        }

        let sessionValue: CompareExchangeSessionValue;

        if (!this._tryGetCompareExchangeValueFromSession(key, x => sessionValue = x)) {
            sessionValue = new CompareExchangeSessionValue(key, 0, "None");
            this._state.set(key, sessionValue);
        }

        return sessionValue.create(item);
    }

    public deleteCompareExchangeValue(key: string, index: number): void;
    public deleteCompareExchangeValue<T>(item: CompareExchangeValue<T>): void;
    public deleteCompareExchangeValue<T>(keyOrItem: string | CompareExchangeValue<T>, index?: number): void {
        if (!TypeUtil.isString(keyOrItem)) {
            return this.deleteCompareExchangeValue(keyOrItem.key, keyOrItem.index);
        }

        const key = keyOrItem as string;
        let sessionValue: CompareExchangeSessionValue;
        if (!this._tryGetCompareExchangeValueFromSession(key, s => sessionValue = s)) {
            sessionValue = new CompareExchangeSessionValue(key, 0, "None");
            this._state.set(key, sessionValue);
        }

        sessionValue.delete(index);
    }

    public clear(): void {
        this._state.clear();

        this._compareExchangeIncludes.clear();
        this._missingDocumentsTooAtomicGuardIndex?.clear();
    }

    protected async _getCompareExchangeValueInternal<T>(key: string): Promise<CompareExchangeValue<T>>
    protected async _getCompareExchangeValueInternal<T>(key: string, clazz: CompareExchangeResultClass<T>): Promise<CompareExchangeValue<T>>
    protected async _getCompareExchangeValueInternal<T>(key: string, clazz?: CompareExchangeResultClass<T>): Promise<CompareExchangeValue<T>> {
        let notTracked: boolean;
        const v = this.getCompareExchangeValueFromSessionInternal<T>(key, t => notTracked = t, clazz);
        if (!notTracked) {
            return v;
        }

        this.session.incrementRequestCount();

        const value = await this.session.operations.send<any>(new GetCompareExchangeValueOperation(key, null, false));
        if (TypeUtil.isNullOrUndefined(value)) {
            this.registerMissingCompareExchangeValue(key);
            return null;
        }

        const sessionValue = this.registerCompareExchangeValue(value);
        if (sessionValue) {
            return sessionValue.getValue(clazz, this.session.conventions);
        }

        return null;
    }

    protected async _getCompareExchangeValuesInternal<T>(startsWith: string, clazz: CompareExchangeResultClass<T>, start: number, pageSize: number): Promise<{ [key: string]: CompareExchangeValue<T> }>;
    protected async _getCompareExchangeValuesInternal<T>(keys: string[]): Promise<{ [key: string]: CompareExchangeValue<T> }>;
    protected async _getCompareExchangeValuesInternal<T>(keys: string[], clazz: CompareExchangeResultClass<T>): Promise<{ [key: string]: CompareExchangeValue<T> }>;
    protected async _getCompareExchangeValuesInternal<T>(startsWithOrKeys: string | string[], clazz?: CompareExchangeResultClass<T>, start?: number, pageSize?: number): Promise<{ [key: string]: CompareExchangeValue<T> }>{
        if (TypeUtil.isString(startsWithOrKeys)) {
            this.session.incrementRequestCount();

            const values = await this.session.operations.send(new GetCompareExchangeValuesOperation({
                startWith: startsWithOrKeys,
                start,
                pageSize,
                clazz
            }), this.session.sessionInfo);

            const results: Record<string, CompareExchangeValue<T>> = {};

            for (const [key, value] of Object.entries(values)) {
                if (TypeUtil.isNullOrUndefined(value)) {
                    this.registerMissingCompareExchangeValue(key);
                    results[key] = null;
                    continue;
                }

                const sessionValue = this.registerCompareExchangeValue(value);
                results[key] = sessionValue.getValue(clazz, this.session.conventions);
            }

            return results;
        } else {
            let notTrackedKeys: Set<string>;
            const results = this.getCompareExchangeValuesFromSessionInternal(startsWithOrKeys, x => notTrackedKeys = x, clazz);

            if (!notTrackedKeys || !notTrackedKeys.size) {
                return results;
            }

            this._session.incrementRequestCount();

            const keysArray = Array.from(notTrackedKeys);
            const values = await this.session.operations.send(new GetCompareExchangeValuesOperation({
                keys: keysArray,
                clazz
            }), this.session.sessionInfo);

            for (const key of keysArray) {
                const value = values[key];
                if (!value) {
                    this.registerMissingCompareExchangeValue(key);
                    results[key] = null;
                    continue;
                }

                const sessionValue = this.registerCompareExchangeValue(value);
                results[value.key] = sessionValue.getValue(clazz, this.session.conventions);
            }

            return results;
        }
    }

    public getCompareExchangeValueFromSessionInternal<T>(key: string, notTracked: (value: boolean) => void, clazz: CompareExchangeResultClass<T>): CompareExchangeValue<T> {
        let sessionValue: CompareExchangeSessionValue;

        if (this._tryGetCompareExchangeValueFromSession(key, s => sessionValue = s)) {
            notTracked(false);
            return sessionValue.getValue(clazz, this.session.conventions);
        }

        notTracked(true);
        return null;
    }

    public getCompareExchangeValuesFromSessionInternal<T>(keys: string[], notTrackedKeysSetter: (values: Set<string>) => void, clazz: CompareExchangeResultClass<T>): { [key: string]: CompareExchangeValue<T> } {
        let noTrackedKeys: Set<string>;

        const results: { [key: string]: CompareExchangeValue<T> } = {};

        if (!keys || !keys.length) {
            notTrackedKeysSetter(null);
            return {};
        }

        for (const key of keys) {
            let sessionValue: CompareExchangeSessionValue;

            if (this._tryGetCompareExchangeValueFromSession(key, s => sessionValue = s)) {
                results[key] = sessionValue.getValue(clazz, this.session.conventions);
                continue;
            }

            if (!noTrackedKeys) {
                noTrackedKeys = new Set<string>();
            }

            noTrackedKeys.add(key);
        }
        notTrackedKeysSetter(noTrackedKeys);

        return results;
    }

    public registerMissingCompareExchangeValue(key: string): CompareExchangeSessionValue {
        const value = new CompareExchangeSessionValue(key, -1, "Missing");
        if (this.session.noTracking) {
            return value;
        }

        this._state.set(key, value);
        return value;
    }

    public registerCompareExchangeIncludes(values: Record<string, CompareExchangeResultItem>, includingMissingAtomicGuards: boolean) {
        if (this.session.noTracking) {
            return;
        }

        if (values) {
            for (const [key, value] of Object.entries(values)) {
                const val = CompareExchangeValueResultParser.getSingleValue(value, false, this.session.conventions, null);

                if (includingMissingAtomicGuards
                    && StringUtil.startsWithIgnoreCase(val.key, COMPARE_EXCHANGE.RVN_ATOMIC_PREFIX)
                    && val.changeVector) {
                    if (!this._missingDocumentsTooAtomicGuardIndex) {
                        this._missingDocumentsTooAtomicGuardIndex = new Map<string, string>();
                    }

                    this._missingDocumentsTooAtomicGuardIndex.set(val.key.substring(COMPARE_EXCHANGE.RVN_ATOMIC_PREFIX.length), val.changeVector);
                } else {
                    this._registerCompareExchangeInclude(val);
                }
            }
        }
    }

    public registerCompareExchangeValue(value: CompareExchangeValue<any>): CompareExchangeSessionValue {
        ClusterTransactionOperationsBase._assertNotAtomicGuard(value);

        if (this.session.noTracking) {
            return new CompareExchangeSessionValue(value);
        }

        this._compareExchangeIncludes.delete(value.key);

        let sessionValue = this._state.get(value.key);

        if (!sessionValue) {
            sessionValue = new CompareExchangeSessionValue(value);
            this._state.set(value.key, sessionValue);
            return sessionValue;
        }

        sessionValue.updateValue(value, this.session.conventions.objectMapper);

        return sessionValue;
    }

    protected _registerCompareExchangeInclude(value: CompareExchangeValue<object>) {
        ClusterTransactionOperationsBase._assertNotAtomicGuard(value);

        if (!this.session.noTracking) {
            return;
        }

        this._compareExchangeIncludes.set(value.key, value);
    }

    private static _assertNotAtomicGuard(value: CompareExchangeValue<object> ) {
        if (StringUtil.startsWithIgnoreCase(value.key, COMPARE_EXCHANGE.RVN_ATOMIC_PREFIX)) {
            throwError("InvalidOperationException", "'" + value.key + "' is an atomic guard and you cannot load it via the session");
        }
    }

    private _tryGetCompareExchangeValueFromSession(key: string, valueSetter: (value: CompareExchangeSessionValue) => void) {
        const value = this._state.get(key);
        valueSetter(value);
        if (!TypeUtil.isNullOrUndefined(value)) {
            return true;
        }

        const includeValue = this._compareExchangeIncludes.get(key);
        if (includeValue) {
            valueSetter(this.registerCompareExchangeValue(includeValue));
            return true;
        }

        return false;
    }

    public prepareCompareExchangeEntities(result: SaveChangesData) {
        if (!this._state.size) {
            return;
        }

        for (const [key, value] of this._state.entries()) {
            const command = value.getCommand(this.session.conventions);
            if (!command) {
                continue;
            }

            result.sessionCommands.push(command);
        }
    }

    public updateState(key: string, index: number) {
        let sessionValue: CompareExchangeSessionValue;
        if (!this._tryGetCompareExchangeValueFromSession(key, x => sessionValue = x)) {
            return;
        }

        sessionValue.updateState(index);
    }
}
