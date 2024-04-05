import { Readable } from "node:stream";
import { HttpResponse } from "../../Primitives/Http";

export interface StreamResultResponse {
    response: HttpResponse;
    stream: Readable;
}
