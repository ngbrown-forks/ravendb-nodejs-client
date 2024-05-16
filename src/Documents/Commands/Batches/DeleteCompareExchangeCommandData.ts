import { ICommandData, CommandType } from "../CommandData.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";

export class DeleteCompareExchangeCommandData implements ICommandData {
    private readonly _index: number;
    public readonly id: string;
    public changeVector: string;
    public name: string;

     public constructor(key: string, index: number) {
        this.id = key;
        this._index = index;
    }

    public get type(): CommandType {
        return "CompareExchangePUT";
    }

    public serialize(conventions: DocumentConventions): object {
        return {
            Id: this.id,
            Index: this._index,
            Type: "CompareExchangeDELETE" as CommandType
        };
    }
}
