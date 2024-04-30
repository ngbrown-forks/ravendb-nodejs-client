import { CloseSubclauseToken } from "./Tokens/CloseSubclauseToken.js";
import { QueryToken } from "./Tokens/QueryToken.js";
import { OpenSubclauseToken } from "./Tokens/OpenSubclauseToken.js";
import { IntersectMarkerToken } from "./Tokens/IntersectMarkerToken.js";
import { StringBuilder } from "../../Utility/StringBuilder.js";

export class DocumentQueryHelper {
    public static addSpaceIfNeeded(
        previousToken: QueryToken, currentToken: QueryToken, writer: StringBuilder): void {
        if (!previousToken) {
            return;
        }

        if ((previousToken.constructor &&
            previousToken.constructor.name === OpenSubclauseToken.name)
            || (currentToken.constructor &&
                (currentToken.constructor.name === CloseSubclauseToken.name
                    || currentToken.constructor.name === IntersectMarkerToken.name))) {
            return;
        }
        writer.append(" ");
    }
}
