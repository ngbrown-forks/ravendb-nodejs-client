export interface IQueryShardedContextBuilder {
    byDocumentId(id: string): IQueryShardedContextBuilder;
    byDocumentIds(ids: string[]): IQueryShardedContextBuilder;
}