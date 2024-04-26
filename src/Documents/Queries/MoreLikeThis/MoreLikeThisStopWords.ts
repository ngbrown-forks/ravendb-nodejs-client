import { SetupDocumentBase } from "../../SetupDocumentBase.js";
import { ObjectUtil } from "../../../Utility/ObjectUtil.js";

export class MoreLikeThisStopWords extends SetupDocumentBase {
    public id: string;
    public stopWords: string[];

    public toRemoteFieldNames() {
        return ObjectUtil.transformObjectKeys(this, { defaultTransform: ObjectUtil.pascal });
    }
}
