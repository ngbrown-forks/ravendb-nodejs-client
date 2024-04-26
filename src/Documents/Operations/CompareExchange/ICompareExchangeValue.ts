import { IMetadataDictionary } from "../../Session/IMetadataDictionary.js";

export interface ICompareExchangeValue {
    key: string;
    index: number;
    value: any;
    metadata: IMetadataDictionary;
    hasMetadata(): boolean;
}
