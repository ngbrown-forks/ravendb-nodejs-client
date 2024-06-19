import { throwError } from "../../Exceptions/index.js";
import { Readable } from "node:stream";

export abstract class BulkInsertOperationBase<T> {
    protected _writer: Readable;
    protected _bulkInsertExecuteTask: Promise<any>;
    protected _aborted: boolean;
    protected _operationId = -1;
    protected _completedWithError = false;
    protected _bulkInsertAborted: Promise<void>;

    public abstract store(entity: T, id: string): Promise<void>;

    protected async _executeBeforeStore() {
        if (!this._writer) {
            await this._waitForId();
            await this._ensureStream();
        }

        if (this._completedWithError) {
            try {
                await this._bulkInsertExecuteTask;
            } catch (error) {
                await this._throwBulkInsertAborted(error);
            } finally {
                this._writer.emit("end");
            }
        }

        if (this._aborted) {
            try {
                await this._bulkInsertAborted;
            } finally {
                this._writer.emit("end");
            }
        }
    }

    protected async _throwBulkInsertAborted(e: Error) {
        let errorFromServer: Error;
        try {
            errorFromServer = await this._getExceptionFromOperation();
        } catch {
            // server is probably down, will propagate the original exception
        }

        if (errorFromServer) {
            throw errorFromServer;
        }

        throwError("BulkInsertAbortedException", "Failed to execute bulk insert", e);
    }

    protected abstract _waitForId(): Promise<void>;
    protected abstract _ensureStream(): Promise<void>;

    protected abstract _getExceptionFromOperation(): Promise<Error>;

    public abstract abort(): Promise<void>;
}
