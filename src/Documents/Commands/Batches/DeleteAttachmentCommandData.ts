import { ICommandData, CommandType } from "../CommandData.js";
import { StringUtil } from "../../../Utility/StringUtil.js";
import { throwError } from "../../../Exceptions/index.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";

export class DeleteAttachmentCommandData implements ICommandData {
    public readonly id: string;
    public readonly name: string;
    public readonly changeVector: string;
    public readonly type: CommandType = "AttachmentDELETE";

    public constructor(documentId: string, name: string, changeVector: string) {
        if (StringUtil.isNullOrWhitespace(documentId)) {
            throwError("InvalidArgumentException", "DocumentId cannot be null");
        }

        if (StringUtil.isNullOrWhitespace(name)) {
            throwError("InvalidArgumentException", "Name cannot be null");
        }

        this.id = documentId;
        this.name = name;
        this.changeVector = changeVector;
    }

    public serialize(conventions: DocumentConventions): object {
        return {
            Id: this.id,
            Name: this.name,
            ChangeVector: this.changeVector,
            Type: "AttachmentDELETE" as CommandType
        };
    }
}
