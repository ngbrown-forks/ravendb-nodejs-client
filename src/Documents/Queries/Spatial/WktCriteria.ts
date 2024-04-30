import { SpatialCriteria } from "./SpatialCriteria.js";
import { SpatialRelation, SpatialUnits } from "../../Indexes/Spatial.js";
import { ShapeToken } from "../../Session/Tokens/ShapeToken.js";

export class WktCriteria extends SpatialCriteria {
    private readonly _shapeWkt: string;
    private readonly _radiusUnits: SpatialUnits;

    public constructor(
        shapeWkt: string, 
        relation: SpatialRelation, 
        radiusUnits: SpatialUnits,
        distanceErrorPct: number) {
        super(relation, distanceErrorPct);
        this._shapeWkt = shapeWkt;
        this._radiusUnits = radiusUnits;
    }

    protected _getShapeToken(addQueryParameter: (o: any) => string): ShapeToken {
        return ShapeToken.wkt(addQueryParameter(this._shapeWkt), this._radiusUnits);
    }
}
