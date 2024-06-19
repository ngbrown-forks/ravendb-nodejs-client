import { ICommandData, CommandType } from "../CommandData.js";
import { StringUtil } from "../../../Utility/StringUtil.js";
import { throwError } from "../../../Exceptions/index.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";

export class CopyAttachmentCommandData implements ICommandData {
    public readonly id: string;
    public readonly changeVector: string;
    public readonly name: string;
    private readonly _destinationId: string;
    private readonly _destinationName: string;

    public get type(): CommandType {
        return "AttachmentCOPY";
    }

    public constructor(
        documentId: string, 
        name: string, 
        destinationDocumentId: string, 
        destinationName: string, 
        changeVector: string) {
        if (StringUtil.isNullOrWhitespace(documentId)) {
            throwError("InvalidArgumentException", "DocumentId is required.");
        }

        if (StringUtil.isNullOrWhitespace(name)) {
            throwError("InvalidArgumentException", "Name is required.");
        }

        if (StringUtil.isNullOrWhitespace(destinationDocumentId)) {
            throwError("InvalidArgumentException", "DestinationDocumentId is required.");
        }

        if (StringUtil.isNullOrWhitespace(destinationName)) {
            throwError("InvalidArgumentException", "DestinationName is required.");
        }
        
        this.id = documentId;
        this.name = name;
        this.changeVector = changeVector;
        this._destinationId = destinationDocumentId;
        this._destinationName = destinationName;
    }

    public getType(): CommandType {
        return "AttachmentMOVE";
    }

    public serialize(conventions: DocumentConventions): object {
        return {
            Id: this.id,
            Name: this.name,
            DestinationId: this._destinationId,
            DestinationName: this._destinationName,
            ChangeVector: this.changeVector,
            Type: "AttachmentCOPY" as CommandType
        };
    }
}
