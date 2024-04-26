import { TypeUtil } from "../../../Utility/TypeUtil.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { EntityToJson } from "../../Session/EntityToJson.js";

export class CompareExchangeValueJsonConverter {
    public static convertToJson(value: object, conventions: DocumentConventions) {
        if (TypeUtil.isNullOrUndefined(value)) {
            return null;
        }

        if (TypeUtil.isPrimitive(value)) {
            return value;
        }

        return EntityToJson.convertEntityToJson(value, conventions);
    }
}
