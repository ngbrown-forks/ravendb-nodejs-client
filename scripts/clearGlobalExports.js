import fs from "node:fs";
// regexp to check: from "(../)*\.\."

fs.unlinkSync("./src/index.ts");
fs.closeSync(fs.openSync("./src/index.ts", 'w'));

