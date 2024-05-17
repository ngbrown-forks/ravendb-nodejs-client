import { DeclareToken } from "../Session/Tokens/DeclareToken.js";
import { LoadToken } from "../Session/Tokens/LoadToken.js";
import { ProjectionBehavior } from "./ProjectionBehavior.js";
import { QueryStatistics } from "../Session/QueryStatistics.js";

export class QueryData {

    public fields: string[];
    public projections: string[];
    public fromAlias: string;
    public declareTokens: DeclareToken[];
    public loadTokens: LoadToken[];
    public isCustomFunction: boolean;
    public mapReduce: boolean;
    public isProjectInto: boolean;
    public queryStatistics: QueryStatistics;
    public projectionBehavior: ProjectionBehavior;

    public constructor(fields: string[], projections: string[]);
    public constructor(
        fields: string[],
        projections: string[],
        fromAlias: string,
        declareTokens: DeclareToken[],
        loadTokens: LoadToken[],
        isCustomFunction: boolean);
    public constructor(
        fields: string[],
        projections: string[],
        fromAlias: string = null,
        declareTokens: DeclareToken[] = null,
        loadTokens: LoadToken[] = null,
        isCustomFunction: boolean = false) {

        this.fields = fields;
        this.projections = projections;
        this.fromAlias = fromAlias;
        this.declareTokens = declareTokens;
        this.loadTokens = loadTokens;
        this.isCustomFunction = isCustomFunction;
    }

    public static customFunction(alias: string, func: string): QueryData {
        return new QueryData([func], [], alias, null, null, true);
    }

    public static throwProjectionIsAlreadyDone() {
        throw new Error("Projection is already done. You should not project your result twice.");
    }

}
