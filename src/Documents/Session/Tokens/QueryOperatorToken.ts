import { QueryOperator } from "../../Queries/QueryOperator.js";
import { QueryToken } from "./QueryToken.js";

export class QueryOperatorToken extends QueryToken {

    private readonly _queryOperator: QueryOperator;

    private constructor(queryOperator: QueryOperator) {
        super();
        this._queryOperator = queryOperator;
    }

    public static AND: QueryOperatorToken = new QueryOperatorToken("AND");

    public static OR: QueryOperatorToken = new QueryOperatorToken("OR");

    public writeTo(writer): void {
        if (this._queryOperator === "AND") {
            writer.append("and");
            return;
        }

        writer.append("or");
    }
}
