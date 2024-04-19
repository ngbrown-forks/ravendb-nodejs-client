import { CONSTANTS } from "../../../Constants";
import {
    ObjectKeyCaseTransformStreamOptionsBase,
    ObjectKeyCaseTransformStreamOptions
} from "../Streams/ObjectKeyCaseTransformStream";
import { FieldNameConversion, ObjectUtil } from "../../../Utility/ObjectUtil";

export const DOCUMENT_LOAD_KEY_CASE_TRANSFORM_PROFILE: ObjectKeyCaseTransformStreamOptionsBase = {
    ignorePaths: [ CONSTANTS.Documents.Metadata.IGNORE_CASE_TRANSFORM_REGEX ],
    ignoreKeys: [/^@/],
    paths: [
        {
            transform: ObjectUtil.camel,
            path: /@metadata\.@attachments/
        }
    ]
};


export type ObjectKeyCaseTransformProfile =
    "DOCUMENT_LOAD"
    | "DOCUMENT_QUERY";

export function getObjectKeyCaseTransformProfile(
    defaultTransform: FieldNameConversion, profile?: ObjectKeyCaseTransformProfile): ObjectKeyCaseTransformStreamOptions {
    switch (profile) {
        case "DOCUMENT_LOAD":
        case "DOCUMENT_QUERY": {
            return Object.assign({ defaultTransform }, DOCUMENT_LOAD_KEY_CASE_TRANSFORM_PROFILE);
        }
        default: {
            return { defaultTransform };
        }
    }
}
