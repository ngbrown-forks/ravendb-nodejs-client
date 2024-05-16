export interface GetConflictsResult {
    id: string;
    results: Conflict[];
    largestEtag: number;
    totalResults: number;
}

export interface Conflict {
    lastModified: Date;
    changeVector: string;
    doc: object;
}
