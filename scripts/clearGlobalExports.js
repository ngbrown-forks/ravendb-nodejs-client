import { unlinkSync, closeSync, openSync } from "node:fs";
// regexp to check: from "(../)*\.\."

unlinkSync("./src/index.ts");
closeSync(openSync("./src/index.ts", 'w'));

