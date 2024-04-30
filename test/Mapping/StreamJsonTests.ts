import fs from "node:fs";
import url from 'node:url';
import { Readable,pipeline } from "node:stream";
import assert from "node:assert"
import Parser from "stream-json/Parser.js";
import StreamValues from "stream-json/streamers/StreamValues.js";
import Stringer from "stream-json/Stringer.js";

describe("stream-json parser and stringer", function () {

    it("stringer using values can stringify negative numbers when parser packing keys", (done) => {

        const content = `{"test":-1}`;
        const readable = new Readable();
        readable.push(content);
        readable.push(null);

        const parser = new Parser({
            streamValues: false 
        });

        let hasNumberChunk = false;
        parser.on("data", x => hasNumberChunk = hasNumberChunk || x.name === "numberChunk");

        const stringerInstance = new Stringer({ useValues: true });
        let output = "";
        stringerInstance.on("data", data => output += data.toString());

        pipeline(
            readable,
            parser,
            stringerInstance, 
            (err) => {
                err ? done(err) : done();
                assert.strictEqual(output, content);
            });
    });

    it("parser with streamNumbers turned off should not emit 'numberChunk' tokens", (done) => {

        const content = `{ "test": -1 }`;
        const readable = new Readable();
        readable.push(content);
        readable.push(null);

        const parser = new Parser({
            streamValues: false
        });

        let hasNumberChunk = false;
        parser.on("data", x => hasNumberChunk = hasNumberChunk || x.name === "numberChunk");

        pipeline(
            readable,
            parser,
            (err) => {
                err ? done(err) : done();
                assert.ok(!hasNumberChunk);
            });
    });

    it("stringer for query result response with negative result etag", (done) => {
        const contentLocation = url.fileURLToPath(url.resolve(import.meta.url, "../Assets/queryResult.json"));
        const content = fs.readFileSync(contentLocation, "utf8");
        const readable = new Readable();
        readable.push(content);
        readable.push(null);

        const parser = new Parser({
            streamValues: false
        });

        const stringerInstance = new Stringer({ useValues: true });
        let output = "";
        stringerInstance.on("data", data => output += data.toString());

        pipeline(
            readable,
            parser,
            stringerInstance, 
            (err) => {
                err ? done(err) : done();
                assert.strictEqual(output, content);
            });
    });

    it("can handle multiple objects in one batch", (done) => {
        const content = `{"A":1}{"B":2}`;
        const readable = new Readable();
        readable.push(content);
        readable.push(null);

        const parser = new Parser({ jsonStreaming: true, streamValues: false });

        const data = [];
        pipeline(
            readable,
            parser,
            new StreamValues().on("data", d => data.push(d)),
            (err) => {
                err ? done(err) : done();
                assert.strictEqual(data.length, 2);
            });
    });
});
