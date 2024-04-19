import { ObjectChangeCaseOptions } from "./../../src/Utility/ObjectUtil";
import assert from "node:assert"
import { ObjectUtil } from "../../src/Utility/ObjectUtil";

describe("ObjectUtil", function () {

    it("can ignore some keys when transforming", async () => {
        const json = `{"Results":[{"Type":"PUT","@id":"users/1","@collection":"Users","@change-vector":"A:1-2ZYfAzcv8Ee+U/12oFmTJQ","@last-modified":"2018-08-22T06:10:29.8004542"}]}`;
        const o = JSON.parse(json);
        const opts = {
            recursive: true,
            arrayRecursive: true,
            ignoreKeys: [/^@/],
            defaultTransform: ObjectUtil.camel
        };
        const transformed = ObjectUtil.transformObjectKeys(o, opts);
        assert.strictEqual("users/1", transformed["results"][0]["@id"]);
    });

    it("can ignore child nodes for selected keys", () => {
        const json = `{"Results":[{"Type":"PUT","@id":"users/1","@collection":"Users","@change-vector":"A:1-2ZYfAzcv8Ee+U/12oFmTJQ","@last-modified":"2018-08-22T06:10:29.8004542"}]}`;
        const o = JSON.parse(json);
        const opts = {
            recursive: true,
            arrayRecursive: true,
            ignorePaths: [/results\.\[\]\.@/i],
            defaultTransform: ObjectUtil.camel
        };
        const transformed = ObjectUtil.transformObjectKeys(o, opts);
        assert.strictEqual("users/1", transformed["results"][0]["@id"]);
    });

    it("can apply different casing convention to different object paths", () => {
        const opts = {
            recursive: true,
            arrayRecursive: true,
            ignoreKeys: [/^@/],
            ignorePaths: [/@metadata\.(@collection)/],
            defaultTransform: ObjectUtil.pascal,
            paths: [
                {
                    path: /@metadata\.@attachments\./,
                    transform: ObjectUtil.camel
                },
            ]
        } as ObjectChangeCaseOptions;

        const obj = {
            "name": "Test",
            "@metadata": {
                "@collection": "test",
                "@attachments": [
                    {
                        Name: "attach1",
                        Type: "test"
                    }
                ]
            }
        };

        const transformed = ObjectUtil.transformObjectKeys(obj, opts);
        assert.ok("Name" in transformed);
        assert.ok("name" in transformed["@metadata"]["@attachments"][0]);
        assert.ok("type" in transformed["@metadata"]["@attachments"][0]);
    });
});
