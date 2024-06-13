import { RavenCommand } from "../RavenCommand.js";
import { HttpResponse } from "../../Primitives/Http.js";


export abstract class AbstractCommandResponseBehavior {
    public abstract handleNotModified<TResult>(command: RavenCommand<TResult>, response: Response, cachedValue: string): Promise<void>;

    public abstract tryHandleNotFound<TResult>(command: RavenCommand<TResult>, response: Response): Promise<boolean>;

    public abstract tryHandleConflict<TResult>(response: HttpResponse, body: string): boolean;

    public abstract tryHandleUnsuccessfulResponse<TResult>(command: RavenCommand<TResult>, response: Response, body: string): boolean;
}
