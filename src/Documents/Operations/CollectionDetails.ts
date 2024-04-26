import { Size } from "../../Utility/SizeUtil.js";

export interface CollectionDetails {
    name: string;
    countOfDocuments: number;
    size: Size;
    documentsSize: Size;
    tombstonesSize: Size;
    revisionsSize: Size;
}
