import { Readable, pipeline } from "node:stream";
import * as assert from "node:assert";
import Parser from "stream-json/Parser.js";
import Pick from "stream-json/filters/Pick.js";
import StreamArray from "stream-json/streamers/StreamArray.js";

describe("streaming tryouts", function () {

    it("can stream array with nulls", (done) => {
        const readable = new Readable();
        readable.push(`{"Results":[null,null],"Includes":{}}`);
        readable.push(null);

        pipeline([
            readable,
            new Parser(),
            new Pick({ filter: "Results" }),
            new StreamArray()
        ], (err: NodeJS.ErrnoException) => {
            if (err) {
                done(err);
                return;
            }

            done();
        })
            .on("data", x => assert.strictEqual(x["value"], null));
    });
});
