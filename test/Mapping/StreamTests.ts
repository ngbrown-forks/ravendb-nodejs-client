import { Readable, pipeline } from "node:stream";
import * as assert from "node:assert";
import { parser } from "stream-json/Parser";
import { pick } from "stream-json/filters/Pick";
import { streamArray } from "stream-json/streamers/StreamArray";

describe("streaming tryouts", function () {

    it("can stream array with nulls", (done) => {
        const readable = new Readable();
        readable.push(`{"Results":[null,null],"Includes":{}}`);
        readable.push(null);

        pipeline([
            readable,
            parser(),
            pick({ filter: "Results" }),
            streamArray()
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
