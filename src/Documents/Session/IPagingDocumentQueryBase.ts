
export interface IPagingDocumentQueryBase<T, TSelf extends IPagingDocumentQueryBase<T, TSelf>> {
    /**
     * Skips the specified count.
     * @param count Items to skip
     */
    skip(count: number): TSelf;

    /**
     * Takes the specified count.
     * @param count Amount of items to take
     */
    take(count: number): TSelf;
}