import { IDisposable } from "../../Types/Contracts.js";

export interface IConnectableChanges<T> extends IDisposable {

    connected: boolean;

    ensureConnectedNow(): Promise<T>;

    on(type: "connectionStatus", handler: () => void): void;
    on(type: "error", handler: (error: Error) => void): void;

    off(type: "connectionStatus", handler: () => void): void;
    off(type: "error", handler: (error: Error) => void): void;
}
