import { Readable } from "node:stream";
import { HttpResponse } from "../../Primitives/Http.js";

export interface StreamResultResponse {
    response: HttpResponse;
    stream: Readable;
}
