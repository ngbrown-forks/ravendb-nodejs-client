import { Stream, Transform, Writable } from "node:stream";
import { RavenCommandResponsePipeline } from "../../../Http/RavenCommandResponsePipeline";
import { DocumentConventions } from "../../../Documents/Conventions/DocumentConventions";
import JsonlStringer from "stream-json/jsonl/Stringer.js";
import Stringer from "stream-json/Stringer.js";
import Pick from "stream-json/filters/Pick.js";
import StreamArray from "stream-json/streamers/StreamArray.js";
import { ObjectUtil } from "../../../Utility/ObjectUtil";

export function getDocumentResultsAsObjects(
    conventions: DocumentConventions,
    queryStream: boolean
): RavenCommandResponsePipeline<object[]> {
    const pipeline = RavenCommandResponsePipeline.create<object[]>();

    const keysTransform = new Transform({
        objectMode: true,
        transform(chunk, encoding, callback) {
            let value = chunk["value"];
            if (!value) {
                return callback();
            }

            if (conventions) {
                value = ObjectUtil.transformDocumentKeys(value, conventions);
            }

            callback(null, {...chunk, value});
        }
    });

    return conventions.useJsonlStreaming
        ? pipeline.parseJsonlAsync(queryStream ? x => x["Item"] : x => x, {
            transforms: [keysTransform]
        })
        : pipeline.parseJsonAsync([
            new Pick({ filter: "Results" }),
            new StreamArray(),
            keysTransform
        ]);
}

export function getDocumentStreamResultsIntoStreamPipeline(
    conventions: DocumentConventions
): RavenCommandResponsePipeline<object[]> {
    const pipeline = RavenCommandResponsePipeline.create<object[]>();

    return conventions.useJsonlStreaming
        ? pipeline.parseJsonlAsync(x => x["Item"], {
            transforms: [
                new JsonlStringer({ replacer: (key, value) => key === '' ? value.value : value }),
            ]
        })
        : pipeline
            .parseJsonAsync([
                new Stringer({ useValues: true })
            ]);
}

export async function streamResultsIntoStream(
    bodyStream: Stream,
    conventions: DocumentConventions,
    writable: Writable): Promise<void> {

    return new Promise<void>((resolve, reject) => {
        getDocumentStreamResultsIntoStreamPipeline(conventions)
            .stream(bodyStream, writable, (err) => {
                err ? reject(err) : resolve();
            });
    });
}
