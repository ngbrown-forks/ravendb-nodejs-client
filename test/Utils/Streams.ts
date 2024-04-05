import { Writable } from "node:stream";

export function getStringWritable(): Writable {
    let buf = "";
    const result = new Writable({
        write(chunk, enc, callback) {
            buf += chunk.toString();
            callback();
        },
        final(callback) {
            (this as any).string = buf;
            callback();
        }
    });

    return result;
}
