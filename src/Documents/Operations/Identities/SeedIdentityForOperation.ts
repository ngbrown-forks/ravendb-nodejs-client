import { IMaintenanceOperation, OperationResultType } from "../OperationAbstractions.js";
import { StringUtil } from "../../../Utility/StringUtil.js";
import { throwError } from "../../../Exceptions/index.js";
import { RavenCommand } from "../../../Http/RavenCommand.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";
import { SeedIdentityForCommand } from "../../Commands/SeedIdentityForCommand.js";

export class SeedIdentityForOperation implements IMaintenanceOperation<number> {
    private readonly _identityName: string;
    private readonly _identityValue: number;
    private readonly _forceUpdate: boolean;

    public constructor(name: string, value: number, forceUpdate: boolean = false) {
        if (StringUtil.isNullOrWhitespace(name)) {
            throwError("InvalidArgumentException", "The field name cannot be null or whitespace.");
        }

        this._identityName = name;
        this._identityValue = value;
        this._forceUpdate = forceUpdate;
    }

    getCommand(conventions: DocumentConventions): RavenCommand<number> {
        return new SeedIdentityForCommand(this._identityName, this._identityValue, this._forceUpdate);
    }

    public get resultType(): OperationResultType {
        return "CommandResult";
    }
}
