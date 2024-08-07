const RavenDB = require("../dist/commonjs/index.js");
const assert = require("node:assert");

const { DocumentStore, DateUtil } = RavenDB;
assert.ok(DocumentStore);

assert.ok(DateUtil.default.stringify(new Date()));
assert.ok(DateUtil.default.parse("2024-05-05T00:00:00.000Z"));
