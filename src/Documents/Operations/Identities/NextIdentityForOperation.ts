import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { StringUtil } from "../../../Utility/StringUtil.js";
import { throwError } from "../../../Exceptions/index.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { NextIdentityForCommand } from "../../Commands/NextIdentityForCommand.js";

export class NextIdentityForOperation implements IMaintenanceOperation<number> {
    private readonly _identityName: string;

    public constructor(name: string) {
        if (StringUtil.isNullOrWhitespace(name)) {
            throwError("InvalidArgumentException", "The field name cannot be null or whitespace.");
        }

        this._identityName = name;
    }

    public getCommand(conventions: DocumentConventions): RavenCommand<number> {
        return new NextIdentityForCommand(this._identityName);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}
