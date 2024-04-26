import { IRaftCommand } from "../../../Http/IRaftCommand.js";
import { RaftIdGenerator } from "../../../Utility/RaftIdGenerator.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { ICommandData } from "../CommandData.js";
import { BatchOptions } from "./BatchOptions.js";
import { SingleNodeBatchCommand } from "./SingleNodeBatchCommand.js";
import { TypeUtil } from "../../../Utility/TypeUtil.js";

export class ClusterWideBatchCommand extends SingleNodeBatchCommand implements IRaftCommand {

    private readonly _disableAtomicDocumentWrites: boolean;

    get disableAtomicDocumentWrites() {
        return this._disableAtomicDocumentWrites;
    }

    public getRaftUniqueRequestId(): string {
        return RaftIdGenerator.newId();
    }

    public constructor(conventions: DocumentConventions, commands: ICommandData[], options?: BatchOptions, disableAtomicDocumentsWrites?: boolean) {
        super(conventions, commands, options, "ClusterWide");
        this._disableAtomicDocumentWrites = disableAtomicDocumentsWrites;
    }

    protected _appendOptions(): string {
        let options = super._appendOptions();

        if (TypeUtil.isNullOrUndefined(this._disableAtomicDocumentWrites)) {
            return "";
        }

        options
            += "&disableAtomicDocumentWrites=" + (this._disableAtomicDocumentWrites ? "true" : "false");

        return options;
    }
}
