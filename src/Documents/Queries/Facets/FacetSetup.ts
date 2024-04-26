import { Facet } from "./Facet.js";
import { RangeFacet } from "./RangeFacet.js";
import { SetupDocumentBase } from "../../SetupDocumentBase.js";
import { ObjectUtil } from "../../../Utility/ObjectUtil.js";

export class FacetSetup extends SetupDocumentBase {
    public id: string;
    public facets: Facet[] = [];
    public rangeFacets: RangeFacet[] = [];

    public toRemoteFieldNames() {
        return ObjectUtil.transformObjectKeys(this, {
            defaultTransform: ObjectUtil.pascal
        });
    }
}
