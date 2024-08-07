import { safeMemoryCache } from "safe-memory-cache";
import { IDisposable } from "../Types/Contracts.js";

export interface CachedItemMetadata {
    changeVector: string;
    response: string;
}

const NOT_FOUND_RESPONSE = "404 Response";

export class HttpCache implements IDisposable {

    private _items: safeMemoryCache;

    constructor(maxKeysSize: number = 500) {
        this._items = safeMemoryCache({
            limit: maxKeysSize
        });
    }

    public dispose(): void {
        this._items.clear();
        this._items = null;
    }

    public clear() {
        this._items.clear();
    }

    public set(url: string, changeVector: string, result: string) {
        const httpCacheItem = new HttpCacheItem();
        httpCacheItem.changeVector = changeVector;
        httpCacheItem.payload = result;
        httpCacheItem.cache = this;

        this._items.set(url, httpCacheItem);
    }

    public get<TResult>(
        url: string,
        itemInfoCallback?: ({ changeVector, response }: CachedItemMetadata) => void): ReleaseCacheItem {
        const item: HttpCacheItem = this._items.get(url);
        if (item) {
            if (itemInfoCallback) {
                itemInfoCallback({
                    changeVector: item.changeVector,
                    response: item.payload
                });
            }

            return new ReleaseCacheItem(item);
        }

        if (itemInfoCallback) {
            itemInfoCallback({
                changeVector: null,
                response: null
            });
        }

        return new ReleaseCacheItem(null);
    }

    public setNotFound(url: string) {
        const httpCacheItem = new HttpCacheItem();
        httpCacheItem.changeVector = NOT_FOUND_RESPONSE;
        httpCacheItem.cache = this;

        this._items.set(url, httpCacheItem);
    }

    public get numberOfItems(): number {
        return this._items["_get_buckets"]().reduce((result, next: Map<string, string>) => {
            return result + next.size;
        }, 0);
    }

    public getMightHaveBeenModified(): boolean {
        return false; // TBD
    }
}

export class ReleaseCacheItem {
    public item: HttpCacheItem;

    constructor(item: HttpCacheItem) {
        this.item = item;
    }

    public notModified(): void {
        if (this.item) {
            this.item.lastServerUpdate = new Date();
        }
    }

    // returns millis
    public get age(): number {
        if (!this.item) {
            return Number.MAX_VALUE;
        }

        return Date.now() - this.item.lastServerUpdate.valueOf();
    }

    public get mightHaveBeenModified() {
        return false; // TBD
    }
}

export class HttpCacheItem {
    public changeVector: string;
    public payload: string;
    public lastServerUpdate: Date;
    public flags: ItemFlags;

    public cache: HttpCache;

    public constructor() {
        this.lastServerUpdate = new Date();
    }
}

export type ItemFlags =
    "None"
    | "NotFound";