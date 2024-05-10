import { getError } from "../Exceptions/index.js";

export interface IDefer<TResult> {
    resolve: (value: TResult) => void;
    reject: (error: any) => void;
    isFulfilled: boolean;
    promise: Promise<TResult>;
}

export async function raceToResolution<TResult>(
    promises: Promise<TResult>[],
    onErrorCallback?: (err) => void): Promise<TResult> {

    // There is no way to know which promise is rejected.
    // So we map it to a new promise to return the index when it fails
    const indexPromises = promises.map((p, index) =>
        p.catch(() => {
            throw index;
        }));

    try {
        return await Promise.race(indexPromises);
    } catch (index) {
        // The promise has rejected, remove it from the list of promises and just continue the race.
        const p = promises.splice(index, 1)[0];
        p.catch(err => {
            if (onErrorCallback) {
                onErrorCallback(err);
            }
        });
        return raceToResolution(promises);
    }
}

export function defer<T>(): IDefer<T> {
    let resolve: (value: T) => void;
    let reject: (error: any) => void;
    let isFulfilled = false;
    const promise = new Promise<T>(function (res, rej) {
        resolve = v => {
            isFulfilled = true;
            res(v);
        }
        reject = rej;
    });
    return {
        resolve,
        reject,
        promise,
        isFulfilled
    };
}

export async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function wrapWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout>;

    const error = getError("TimeoutException", `Timeout after ${ms} ms.`);

    const timeoutPromise = new Promise<Error>((resolve) => {
        timeoutHandle = setTimeout(() => {
            resolve(error)
        }, ms);
    })

    try {
        const raceWinner = await Promise.race([promise, timeoutPromise]);
        if (raceWinner === error) {
            // timeout win
            throw raceWinner;
        } else {
            // cancel existing timeout
            clearTimeout(timeoutHandle);
            return raceWinner as T;
        }
    } catch (e) {
        clearTimeout(timeoutHandle);
        throw e;
    }

}

export class AsyncTimeout {
    public get promise() {
        return this._promise;
    }

    public get timedOut() {
        return this._timedOut;
    }

    private _timedOut: boolean = false;

    private _timer: ReturnType<typeof setInterval>;

    private _promise: Promise<void>;

    private _op: string;

    private _resolve: () => void;

    private _reject: (err: Error) => void;

    public constructor(ms: number, op?: string) {
        this._op = op;
        this._promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });

        this._timer = setTimeout(() => {
            this._timedOut = true;
            this._reject(this._getTimeoutError(ms));
        }, ms);
    }

    private _getTimeoutError(ms) {
        const opText = this._op ? `Operation '${this._op}'` : `Operation`;
        const timeoutError = getError("TimeoutError", `${opText} timed out after ${ms} ms.`);
        return timeoutError;
    }

    public cancel() {
        if (this._timer) {
            clearTimeout(this._timer);
        }

        this._resolve();
    }
}

export type PromiseStatus = "PENDING" | "RESOLVED" | "REJECTED";
export class PromiseStatusTracker<T> {
    private _status: PromiseStatus;
    private _promise: Promise<T>;

    public constructor(promise: Promise<T>) {
        if (!promise) {
            throw new Error("Promise to track cannot be null.");
        }

        this._status = "PENDING";
        this._promise = promise;

        this._promise
            .then(() => this._status = "RESOLVED")
            .catch(() => this._status = "REJECTED");
    }

    public static track<T>(promise: Promise<T>): PromiseStatusTracker<T> {
        return new PromiseStatusTracker(promise);
    }

    public isFullfilled() {
        return this._status === "REJECTED" || this._status === "RESOLVED";
    }

    public isResolved() {
        return this._status === "RESOLVED";
    }

    public isRejected() {
        return this._status === "REJECTED";
    }
}
