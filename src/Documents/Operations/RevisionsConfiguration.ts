import { SetupDocumentBase } from "../SetupDocumentBase.js";
import { RevisionsCollectionConfiguration } from "./RevisionsCollectionConfiguration.js";
import { ObjectUtil } from "../../Utility/ObjectUtil.js";

export class RevisionsConfiguration extends SetupDocumentBase {
    public defaultConfig: RevisionsCollectionConfiguration;
    public collections: Map<string, RevisionsCollectionConfiguration>;

    public toRemoteFieldNames() {
        return {
            Default: this.defaultConfig ? this.defaultConfig.toRemoteFieldNames() : undefined,
            Collections: this.collections
                ? ObjectUtil.mapToLiteral(this.collections, (key, value) => value.toRemoteFieldNames())
                : undefined
        };
    }
}
