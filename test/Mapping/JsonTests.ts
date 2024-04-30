import assert from "node:assert"
import {
    pascalCaseReplacer,
    camelCaseReplacer,
    pascalCaseReviver,
    camelCaseReviver
} from "../../src/Mapping/Json/index.js";

describe("Json module", () => {

    describe("stringifyJson()", () => {

        const o = {
            "a": 1,
            "prop": 2,
            "obj": {
                prop2: "test"
            },
            "Arr": [
                1, 2, "test"
            ],
            "@metadata": {}
        };

        it("stringifies JSON", () => {
            const result = JSON.stringify(o);
            assert.strictEqual(`{"a":1,"prop":2,"obj":{"prop2":"test"},"Arr":[1,2,"test"],"@metadata":{}}`, result);
        });

        it("stringifies to PascalCased JSON", () => {
            const result = JSON.stringify(o, pascalCaseReplacer);
            assert.strictEqual(`{"A":1,"Prop":2,"Obj":{"Prop2":"test"},"Arr":[1,2,"test"],"@metadata":{}}`, result);
        });

        it("stringifies to camelCased JSON", () => {
            const result = JSON.stringify(o, camelCaseReplacer);
            assert.strictEqual(result, `{"a":1,"prop":2,"obj":{"prop2":"test"},"arr":[1,2,"test"],"@metadata":{}}`);
        });
    });

    describe("parseJson()", () => {

        const o = {
            "a": 1,
            "prop": 2,
            "obj": {
                prop2: "test"
            },
            "Arr": [
                1, 2, "test"
            ],
            "@metadata": {}
        };

        const JSON_PASCAL_CASED = `{"A":1,"Prop":2,"Obj":{"Prop2":"test"},"Arr":[1,2,"test"],"@metadata":{}}`;
        const JSON_CAMEL_CASED = `{"@metadata":{},"a":1,"prop":2,"obj":{"prop2":"test"},"arr":[1,2,"test"]}`;

        it("parse JSON", () => {
            const result = JSON.stringify(JSON.parse(JSON_CAMEL_CASED));
            assert.strictEqual(result, JSON_CAMEL_CASED);
        });

        it("parses PascalCased JSON to camelCased object", () => {
            const result = JSON.stringify(JSON.parse(JSON_PASCAL_CASED, camelCaseReviver));
            assert.strictEqual(JSON_CAMEL_CASED, result);
        });

        it("parses PascalCased JSON to PascalCased object", () => {
            const result = JSON.stringify(JSON.parse(JSON_PASCAL_CASED, pascalCaseReviver));
            assert.strictEqual(JSON_PASCAL_CASED, result);
        });

        it("parses JSON with keys starting with @", () => {
            const jsonString = `{"Results":[{"Name":"Marcin","Age":30,"@metadata":{"@change-vector":"A:1-raDVjL7QqEC3EBoL2rpHYA","@id":"users/1","@last-modified":"2018-04-20T13:58:37.2156934Z"}}],"Includes":{}}`;
            const result = JSON.parse(jsonString, camelCaseReviver);
            assert.ok(result.results[0]["@metadata"]);
            assert.strictEqual("A:1-raDVjL7QqEC3EBoL2rpHYA", result.results[0]["@metadata"]["@change-vector"]);
        });

    });

    describe.skip("Rule based reviver won't work", () => {
        // TODO
        // JsonSerializer impl must be replaced with streaming/sax-based parser
        // e.g. https://github.com/dscape/clarinet
        // reviver won't work here, since it starts reviving objects starting from tree leaves

        let testStr;

        beforeEach(() => {
            testStr = `{ "Results": [ { "Name": "Marcin", "age": 31 } ], "Includes": [] }`;
        });

        it("can skip objects", () => {
            const result: any = JSON.parse(testStr, camelCaseReviver);

            assert.ok(result.results);
            assert.ok(result.results[0].Name);
        });

    });
});
