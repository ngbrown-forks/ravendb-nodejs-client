import { IndexQuery } from "../Queries/IndexQuery.js";
import { QueryResult } from "../Queries/QueryResult.js";
import { TypedEventEmitter } from "../../Primitives/Events.js";

export interface StreamingQueryEvents {
    "afterStreamExecuted": object;
}

export interface QueryEvents extends StreamingQueryEvents {
    "beforeQueryExecuted": IndexQuery;
    "afterQueryExecuted": QueryResult;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryEventsEmitter
    extends TypedEventEmitter<QueryEvents> {
}
