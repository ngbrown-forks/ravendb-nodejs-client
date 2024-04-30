

export class CaseInsensitiveKeysStore {

    private _originalKeys: Map<string, string> = new Map();

    public getKey(key: string) {
        return this._originalKeys.get(
            this.normalizeKey(key));
    }

    public getKeys(): IterableIterator<string> {
        return this._originalKeys.values();
    }

    public setKey(origKey: string): string {
        const lowerKey = this.normalizeKey(origKey);
        this._originalKeys.set(lowerKey, origKey);
        return lowerKey;
    }

    public deleteKey(origKey: string): string {
        const lowerKey = this.normalizeKey(origKey);
        this._originalKeys.delete(lowerKey);
        return lowerKey;
    }

    public normalizeKey(key: string) {
        return key ? key.toLowerCase() : key;
    }
}
