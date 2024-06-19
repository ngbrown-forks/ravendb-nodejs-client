import { throwError } from "../../Exceptions/index.js";
import { IndexQueryWithParameters } from "./IndexQueryWithParameters.js";
import { HashCalculator } from "./HashCalculator.js";
import { TypeUtil } from "../../Utility/TypeUtil.js";
import { DocumentConventions } from "../Conventions/DocumentConventions.js";
import { JsonSerializer } from "../../Mapping/Json/Serializer.js";
import { ITypesAwareObjectMapper } from "../../Mapping/ObjectMapper.js";
import { ServerCasing } from "../../Types/index.js";

export interface IndexQueryParameters {
    [key: string]: object;
}

export class IndexQuery extends IndexQueryWithParameters<IndexQueryParameters> {

    public constructor();
    public constructor(query?: string);
    public constructor(query?: string) {
        super();
        this.query = query;
    }

    /**
     * Indicates if query results should be read from cache (if cached previously)
     * or added to cache (if there were no cached items prior)
     */
    public disableCaching: boolean;

    public getQueryHash(mapper: ITypesAwareObjectMapper): string {
        const hasher = new HashCalculator();
        try {
            hasher.write(this.query, mapper);
            hasher.write(this.waitForNonStaleResults);
            hasher.write(this.skipDuplicateChecking);
            hasher.write(this.skipStatistics);
            hasher.write(this.waitForNonStaleResultsTimeout || 0);
            hasher.write(this.queryParameters, mapper);
            return hasher.getHash();
        } catch (err) {
            throwError("RavenException", "Unable to calculate hash", err);
        }
    }
}

export function writeIndexQuery(conventions: DocumentConventions, indexQuery: IndexQuery): string {
    const result = {
        Query: indexQuery.query
    } as ServerCasing<IndexQuery>;

    if (indexQuery.waitForNonStaleResults) {
        result.WaitForNonStaleResults = indexQuery.waitForNonStaleResults;
    }

    if (!TypeUtil.isNullOrUndefined(indexQuery.waitForNonStaleResultsTimeout)) {
        result.WaitForNonStaleResultsTimeout = indexQuery.waitForNonStaleResultsTimeout;
    }

    if (indexQuery.disableCaching) {
        result.DisableCaching = indexQuery.disableCaching;
    }

    if (indexQuery.skipDuplicateChecking) {
        result.SkipDuplicateChecking = indexQuery.skipDuplicateChecking;
    }

    if (!indexQuery.queryParameters) {
        result.QueryParameters = null;
    } else {
        result.QueryParameters = indexQuery.queryParameters;
    }

    if (indexQuery.projectionBehavior && indexQuery.projectionBehavior !== "Default") {
        result.ProjectionBehavior = indexQuery.projectionBehavior;
    }

    return JsonSerializer.getDefault().serialize(result);
}
