import { FacetBase } from "./FacetBase.js";
import { FacetToken } from "../../Session/Tokens/FacetToken.js";
import { FacetOptions } from "./index.js";

export class Facet extends FacetBase {

    public fieldName: string;
    public options: FacetOptions;

    public toFacetToken(addQueryParameter: (o: any) => string): FacetToken {
        return FacetToken.create(this, addQueryParameter);
    }
}
