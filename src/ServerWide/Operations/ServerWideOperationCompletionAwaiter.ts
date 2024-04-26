import { OperationCompletionAwaiter } from "../../Documents/Operations/OperationCompletionAwaiter.js";
import { RavenCommand, IRavenResponse } from "../../Http/RavenCommand.js";
import { GetServerWideOperationStateCommand } from "./GetServerWideOperationStateOperation.js";
import { RequestExecutor } from "../../Http/RequestExecutor.js";
import { DocumentConventions } from "../../Documents/Conventions/DocumentConventions.js";
import { KillServerOperationCommand } from "../../Documents/Commands/KillServerOperationCommand.js";

export class ServerWideOperationCompletionAwaiter extends OperationCompletionAwaiter {

    public constructor(requestExecutor: RequestExecutor, conventions: DocumentConventions, id: number, nodeTag?: string) {
        super(requestExecutor, conventions, id);

        this.nodeTag = nodeTag;
    }

    protected _getOperationStateCommand(conventions: DocumentConventions, id: number, nodeTag?: string): RavenCommand<IRavenResponse> {
        return new GetServerWideOperationStateCommand(id, nodeTag);
    }

    protected _getKillOperationCommand(id: number, nodeTag: string): RavenCommand<void> {
        return new KillServerOperationCommand(id, nodeTag);
    }
}
