import { FacetBase } from "./FacetBase.js";
import { FacetToken } from "../../Session/Tokens/FacetToken.js";

export class RangeFacet extends FacetBase {

    private readonly _parent: FacetBase;

    public ranges: string[] = [];

    public constructor(parent?: FacetBase) {
        super();
        this._parent = parent;
    }

    public toFacetToken(addQueryParameter: (o: any) => string): FacetToken {
        if (this._parent) {
            return this._parent.toFacetToken(addQueryParameter);
        }

        return FacetToken.create(this, addQueryParameter);
    }
}
