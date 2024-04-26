import { QueryToken } from "./QueryToken.js";
import { StringBuilder } from "../../../Utility/StringBuilder.js";

export class GraphQueryToken extends QueryToken {
    private readonly _query: string;

    public constructor(query: string) {
        super();

        this._query = query;
    }

    public writeTo(writer: StringBuilder) {
        writer.append(this._query);
    }
}