import { GetIndexErrorsOperation, IDocumentStore } from "../../src/index.js";
import { throwError } from "../../src/Exceptions/index.js";
import { StringBuilder } from "../../src/Utility/StringBuilder.js";
import { EOL } from "../../src/Utility/OsUtil.js";

export class RavenTestHelper {
    public static async assertNoIndexErrors(store: IDocumentStore, databaseName?: string) {
        const errors = await store.maintenance.forDatabase(databaseName).send(new GetIndexErrorsOperation());

        let sb: StringBuilder;

        for (const indexErrors of errors) {
            if (!indexErrors || !indexErrors.errors || !indexErrors.errors.length) {
                continue;
            }

            if (!sb) {
                sb = new StringBuilder();
            }

            sb.append("Index Errors for '")
                .append(indexErrors.name)
                .append(" '(")
                .append(indexErrors.errors.length.toString())
                .append(")");
            sb.append(EOL);

            for (const indexError of indexErrors.errors) {
                sb.append("- " + indexError);
                sb.append(EOL);
            }

            sb.append(EOL);
        }

        if (!sb) {
            return;
        }

        throwError("InvalidOperationException", sb.toString());
    }
}
