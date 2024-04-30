import { AggregationQueryBase } from "./AggregationQueryBase.js";
import { IRawDocumentQuery } from "../../Session/IRawDocumentQuery.js";
import { InMemoryDocumentSessionOperations } from "../../Session/InMemoryDocumentSessionOperations.js";
import { throwError } from "../../../Exceptions/index.js";
import { IndexQuery } from "../IndexQuery.js";
import { QueryResult } from "../QueryResult.js";

export class AggregationRawDocumentQuery<T extends object> extends AggregationQueryBase {
    private readonly _source: IRawDocumentQuery<T>;


    constructor(source: IRawDocumentQuery<T>, session: InMemoryDocumentSessionOperations) {
        super(session);

        this._source = source;

        if (!source) {
            throwError("InvalidArgumentException", "Source cannot be null");
        }
    }

    protected _getIndexQuery(updateAfterQueryExecuted?: boolean): IndexQuery {
        return this._source.getIndexQuery();
    }

    public emit(eventName: "afterQueryExecuted", queryResult: QueryResult) {
        if (eventName === "afterQueryExecuted") {
            this._source.emit(eventName, queryResult);
        }
    }
}