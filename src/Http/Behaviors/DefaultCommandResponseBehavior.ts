import { AbstractCommandResponseBehavior } from "./AbstractCommandResponseBehavior.js";
import { RavenCommand } from "../RavenCommand.js";
import { ExceptionDispatcher } from "../../Exceptions/index.js";
import { HttpResponse } from "../../Primitives/Http.js";

export class DefaultCommandResponseBehavior extends AbstractCommandResponseBehavior {
    public static readonly INSTANCE = new DefaultCommandResponseBehavior();

    private constructor() {
        super();

        // empty
    }

    async handleNotModified<TResult>(command: RavenCommand<TResult>, response: Response, cachedValue: string) {
        if (command.responseType === "Object") {
            await command.setResponseFromCache(cachedValue);
        }
    }

    async tryHandleNotFound<TResult>(command: RavenCommand<TResult>, response: Response): Promise<boolean> {
        switch (command.responseType) {
            case "Empty": {
                return true;
            }
            case "Object": {
                await command.setResponseAsync(null, false)
                return true;
            }
            default: {
                command.setResponseRaw(response, null);
                break;
            }
        }
        return true;
    }

    tryHandleConflict<TResult>(response: HttpResponse, body: string): boolean {
        ExceptionDispatcher.throwException(response, body);
        return false;
    }

    tryHandleUnsuccessfulResponse<TResult>(command: RavenCommand<TResult>, response: Response, body: string): boolean {
        command.onResponseFailure(response);
        ExceptionDispatcher.throwException(response, body);

        return false;
    }
}
