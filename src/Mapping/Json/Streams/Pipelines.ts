import { Stream, Transform, Writable } from "node:stream";
import { RavenCommandResponsePipeline } from "../../../Http/RavenCommandResponsePipeline.js";
import { DocumentConventions } from "../../../Documents/Conventions/DocumentConventions.js";
import { ObjectUtil } from "../../../Utility/ObjectUtil.js";
import { importFix } from "../../../Utility/ImportUtil.js";
import JsonlParser from "stream-json/jsonl/Parser.js";

export function getDocumentResultsAsObjects(
    parserProvider: new () => JsonlParser,
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

    return pipeline.parseJsonlAsync(parserProvider, queryStream ? x => x["Item"] : x => x, {
        transforms: [keysTransform]
    });
}

export async function getDocumentStreamResultsIntoStreamPipeline(
    parserProvider: new () => JsonlParser,
    conventions: DocumentConventions
): Promise<RavenCommandResponsePipeline<object[]>> {
    const pipeline = RavenCommandResponsePipeline.create<object[]>();

    const JsonlStringer = (await import(importFix("stream-json/jsonl/Stringer.js"))).default;

    return pipeline.parseJsonlAsync(parserProvider, x => x["Item"], {
            transforms: [
                new JsonlStringer({ replacer: (key, value) => key === '' ? value.value : value }),
            ]
        });
}

export async function streamResultsIntoStream(
    parserProvider: new () => JsonlParser,
    bodyStream: Stream,
    conventions: DocumentConventions,
    writable: Writable): Promise<void> {
    const pipeline = await getDocumentStreamResultsIntoStreamPipeline(parserProvider, conventions);

    return new Promise<void>((resolve, reject) => {
        pipeline
            .stream(bodyStream, writable, (err) => {
                err ? reject(err) : resolve();
            });
    });
}
