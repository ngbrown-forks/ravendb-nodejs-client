import { IDisposable } from "../../Types/Contracts.js";
import { Buffer } from "node:buffer";
import { createGzip } from "node:zlib";
import { throwError } from "../../Exceptions/index.js";
import { BulkInsertCommand } from "../BulkInsertOperation.js";



export class BulkInsertWriterBase implements IDisposable {
    private readonly _maxSizeInBuffer = 1024 * 1024;

    private _asyncWrite: Promise<void> = Promise.resolve();
    private _asyncWriteDone: boolean = true;
    private _currentWriter: BulkInsertStream;
    private _backgroundWriter: BulkInsertStream;
    private _isInitialWrite: boolean = true;

    protected lastFlushToStream: Date;

    //TODO: internal readonly BulkInsertOperation.BulkInsertStreamExposerContent StreamExposer;

    protected constructor() {
        /* TODO
        StreamExposer = new BulkInsertOperation.BulkInsertStreamExposerContent();

         */

        this._currentWriter = new BulkInsertStream();
        this._backgroundWriter = new BulkInsertStream();

        this.updateFlushTime();
    }

    dispose() { //TODO: remember to call this method
        /* TODO
         try
            {
                if (StreamExposer.IsDone)
                    return;

                try
                {
                    if (_requestBodyStream != null)
                    {
                        _currentWriteStream.WriteByte((byte)']');
                        _currentWriteStream.Flush();
                        await _asyncWrite.ConfigureAwait(false);

                        await WriteToStreamAsync(_currentWriteStream, _requestBodyStream, _memoryBuffer).ConfigureAwait(false);
                        await _requestBodyStream.FlushAsync(_token).ConfigureAwait(false);
                    }
                }
                finally
                {
                    StreamExposer.Done();
                }
            }
            finally
            {
                using (StreamExposer)
                using (returnMemoryBuffer)
                using (returnBackgroundMemoryBuffer)
                {

                }
            }
        });
         */
    }

    public initialize(): void {
        this.onCurrentWriteStreamSet(this._currentWriter);
    }

    private async flushIfNeeded(force = false): Promise<void> { //TODO: review this method
        if (this._currentWriter.length > this._maxSizeInBuffer || this._asyncWriteDone) {
            await this._asyncWrite;

            const tmp = this._currentWriter;
            this._currentWriter = this._backgroundWriter;
            this._backgroundWriter = tmp;

            this._currentWriter = new BulkInsertStream();

            const buffer = this._backgroundWriter.toBuffer();
            force = true; // original version: force || this.isHeartbeatIntervalExceeded() || ; in node.js we need to force flush to use backpressure in steams
            this._asyncWriteDone = false;
            this._asyncWrite = this.writeToStream(buffer, force);
        }
    }

    private updateFlashTime(): void {
        this.lastFlushToStream = new Date();
    }

    protected onCurrentWriteStreamSet(currentWriteStream: BulkInsertStream): void {
        // empty by design
    }

    /* TODO
     protected Task WriteToStreamAsync(Stream src, Stream dst)
    {
        return WriteToStreamAsync(src, dst, _memoryBuffer);
    }

    protected Task WriteToRequestStreamAsync(Stream src)
    {
        return WriteToStreamAsync(src, _requestBodyStream, _memoryBuffer);
    }

    private async Task WriteToStreamAsync(Stream src, Stream dst, JsonOperationContext.MemoryBuffer buffer, bool forceDstFlush = false)
    {
        src.Seek(0, SeekOrigin.Begin);

        while (true)
        {
            int bytesRead = await src.ReadAsync(buffer.Memory.Memory, _token).ConfigureAwait(false);

            if (bytesRead == 0)
                break;

            await dst.WriteAsync(buffer.Memory.Memory.Slice(0, bytesRead), _token).ConfigureAwait(false);

            if (forceDstFlush)
            {
                UpdateFlushTime();
                await dst.FlushAsync(_token).ConfigureAwait(false);
            }
        }
    }
     */

    protected async _ensureStream() { //TODO review this method
        try {
            this._requestBodyStream = new RequestBodyStream();
            this._stream = this._requestBodyStream;

            if (this.useCompression) {
                this._compressedStream = createGzip();
                pipeline(this._requestBodyStream, this._compressedStream);
            }

            const bulkCommand =
                new BulkInsertCommand(this._operationId, this._compressedStream ?? this._requestBodyStream, this._nodeTag, this._options.skipOverwriteIfUnchanged);
            bulkCommand.useCompression = this._useCompression;

            this._bulkInsertExecuteTask = this._requestExecutor.execute(bulkCommand);

            this._currentWriter.push("[");

            this._bulkInsertExecuteTask
                .catch(() => this._bulkInsertExecuteTaskErrored = true);

        } catch (e) {
            throwError("RavenException", "Unable to open bulk insert stream.", e);
        }
    }


    /* TODO
       public void DisposeRequestStream()
    {
        _requestBodyStream?.Dispose();
    }
     */
}

export class BulkInsertStream {

    private readonly _items: Array<string | Buffer> = [];
    private totalLength = 0;

    public push(data: string | Buffer) {
        this._items.push(data);
        this.totalLength += Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
    }

    public toBuffer(): Buffer {
        const result = Buffer.allocUnsafe(this.totalLength);
        let idx = 0;
        for (const inputElement of this._items) {
            if (Buffer.isBuffer(inputElement)) {
                inputElement.copy(result, idx);
                idx += inputElement.length;
            } else {
                result.write(inputElement, idx);
                idx += Buffer.byteLength(inputElement);
            }
        }

        return result;
    }

    public get length() {
        return this.totalLength;
    }
}
