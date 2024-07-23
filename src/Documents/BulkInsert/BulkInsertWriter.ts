import { BulkInsertStream, BulkInsertWriterBase } from "./BulkInsertWriterBase.js";
import { Buffer } from "node:buffer";
import { throwError } from "../../Exceptions/index.js";

export class BulkInsertWriter extends BulkInsertWriterBase {
    public constructor() {
        super();
    }

    protected onCurrentWriteStreamSet(currentWriteStream: BulkInsertStream) {
        // empty
    }

    // no need for flushIfNeeded -> it uses parent version

    public write(value: string | Buffer) {
        this._currentWriter.push(value);
    }

    private static throwUnexpectedWriteStream() {
        throwError("InvalidOperationException", "We got stream for which we don't have the stream writer defined");
    }
}
