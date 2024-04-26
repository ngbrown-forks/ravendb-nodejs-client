import { SetupDocumentBase } from "../SetupDocumentBase.js";
import { ObjectUtil } from "../../Utility/ObjectUtil.js";

export class RevisionsCollectionConfiguration extends SetupDocumentBase {

    public minimumRevisionsToKeep?: number;
    public minimumRevisionAgeToKeep?: string;
    public disabled: boolean;
    public purgeOnDelete?: boolean;
    public maximumRevisionsToDeleteUponDocumentUpdate?: number;

    public toRemoteFieldNames() {
        return ObjectUtil.transformObjectKeys(this, { defaultTransform: ObjectUtil.pascal });
    }
}
