import { Stream, Transform, Writable } from "node:stream";
import { RavenCommandResponsePipeline } from "../../../Http/RavenCommandResponsePipeline.js";
import { DocumentConventions } from "../../../Documents/Conventions/DocumentConventions.js";
import JsonlStringer from "stream-json/jsonl/Stringer.js";
import { ObjectUtil } from "../../../Utility/ObjectUtil.js";

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

    return pipeline.parseJsonlAsync(queryStream ? x => x["Item"] : x => x, {
        transforms: [keysTransform]
    });
}

export function getDocumentStreamResultsIntoStreamPipeline(
    conventions: DocumentConventions
): RavenCommandResponsePipeline<object[]> {
    const pipeline = RavenCommandResponsePipeline.create<object[]>();

    return pipeline.parseJsonlAsync(x => x["Item"], {
            transforms: [
                new JsonlStringer({ replacer: (key, value) => key === '' ? value.value : value }),
            ]
        });
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
