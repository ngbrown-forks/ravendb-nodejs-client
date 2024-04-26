import { CompareExchangeValue } from "../Operations/CompareExchange/CompareExchangeValue.js";
import { CompareExchangeResultClass } from "../../Types/index.js";
import { ClusterTransactionOperationsBase } from "./ClusterTransactionOperationsBase.js";
import { IClusterTransactionOperations } from "./IClusterTransactionOperations.js";
import { TypeUtil } from "../../Utility/TypeUtil.js";
import { LazyClusterTransactionOperations } from "./Operations/Lazy/LazyClusterTransactionOperations.js";
import { DocumentSession } from "./DocumentSession.js";

export class ClusterTransactionOperations 
    extends ClusterTransactionOperationsBase 
    implements IClusterTransactionOperations {
    
    public constructor(session: DocumentSession) {
        super(session);
    }

    public get lazily() {
        return new LazyClusterTransactionOperations(this._session);
    }

    public getCompareExchangeValue<T>(key: string): Promise<CompareExchangeValue<T>>;
    public getCompareExchangeValue<T>(key: string, type: CompareExchangeResultClass<T>): Promise<CompareExchangeValue<T>>;
    public async getCompareExchangeValue<T>(
        key: string, 
        type?: CompareExchangeResultClass<T>): Promise<CompareExchangeValue<T>> {

        return this._getCompareExchangeValueInternal(key, type);
    }

    public getCompareExchangeValues<T>(
        keys: string[]): Promise<{ [key: string]: CompareExchangeValue<T> }>;
    public getCompareExchangeValues<T>(
        keys: string[], type: CompareExchangeResultClass<T>): Promise<{ [key: string]: CompareExchangeValue<T> }>;
    public getCompareExchangeValues<T>(
        startsWith: string): Promise<{ [key: string]: CompareExchangeValue<T> }>;
    public getCompareExchangeValues<T>(
        startsWith: string,
        type: CompareExchangeResultClass<T>): Promise<{ [key: string]: CompareExchangeValue<T> }>;
    public getCompareExchangeValues<T>(
        startsWith: string,
        type: CompareExchangeResultClass<T>,
        start: number): Promise<{ [key: string]: CompareExchangeValue<T> }>;
    public getCompareExchangeValues<T>(
        startsWith: string,
        type: CompareExchangeResultClass<T>,
        start: number,
        pageSize: number): Promise<{ [key: string]: CompareExchangeValue<T> }>;
    public getCompareExchangeValues<T>(
        keysOrStartsWith: string[] | string,
        type?: CompareExchangeResultClass<T>,
        start?: number,
        pageSize?: number)
            : Promise<{ [key: string]: CompareExchangeValue<T> }> {

        if (TypeUtil.isArray(keysOrStartsWith)) {
            return this._getCompareExchangeValuesInternal(keysOrStartsWith, type);
        } else {
            return this._getCompareExchangeValuesInternal(keysOrStartsWith, type, start ?? 0, pageSize ?? 25);
        }
    }
}
