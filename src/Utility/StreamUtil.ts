import { finished, pipeline, Stream, Readable } from "node:stream";
import { promisify } from "node:util";
import { Buffer } from "node:buffer";

export const finishedAsync: (src: any) => Promise<any> =
    promisify(finished);
export const pipelineAsync: (...src: Stream[]) => Promise<any> =
    promisify(pipeline) as any;


export async function readToBuffer(stream: Stream): Promise<Buffer> {
    const chunks: Uint8Array[] = [];
    stream
        .on("data", data => chunks.push(data));

    await finishedAsync(stream);

    return Buffer.concat(chunks);
}

export async function readToEnd(readable: Readable | Stream): Promise<string> {
    const chunks = [];
    readable.on("data", chunk => chunks.push(chunk));

    await finishedAsync(readable);
    return Buffer.concat(chunks).toString("utf8");
}

export function bufferToReadable(b: Buffer) {
    const result = new Readable();
    result.push(b);
    result.push(null);
    return result;
}

export function stringToReadable(s: string) {
    const result = new Readable();
    result.push(s);
    result.push(null);
    return result;
}
