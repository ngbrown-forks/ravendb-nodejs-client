import { randomUUID } from "node:crypto";

export class RaftIdGenerator {
    public static newId(): string {
        return randomUUID();
    }

    // if the don't care id is used it may cause that on retry/resend of the command we will end up in double applying of the command (once for the original request and for the retry).
    public static dontCareId(): string {
        return "";
    }
}