import { Stream } from "node:stream";
import { EOL } from "./OsUtil.js";

export class StringBuilder {
    private s: any[] = [];
    private readonly newline: string;

    public constructor(v?: any) {
        this.append(v);

        Stream.call(this);

        this.newline = EOL;
    }

    public append(v: any) {
        if (v != null) {
            this.s.push(v);
        }

        return this;
    }

    public appendLine(v: any) {
        this.s.push(this.newline);

        if (v != null) {
            this.s.push(v);
        }

        return this;
    }

    public clear() {
        this.s.length = 0;
    }

    public toString() {
        return this.s.length === 0 ? "" : this.s.join("");
    }
}
