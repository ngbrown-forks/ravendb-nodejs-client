import { DocumentStore, DateUtil } from "../dist/esm/index.js";
import assert from "node:assert";

assert.ok(DocumentStore);

assert.ok(DateUtil.default.stringify(new Date()));
assert.ok(DateUtil.default.parse("2024-05-05T00:00:00.000Z"));