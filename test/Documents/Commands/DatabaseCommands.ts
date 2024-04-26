import { IDisposable } from "../../../src/Types/Contracts.js";
import { IDocumentStore } from "../../../src/Documents/IDocumentStore.js";
import { RequestExecutor } from "../../../src/Http/RequestExecutor.js";
import { InMemoryDocumentSessionOperations } from "../../../src/Documents/Session/InMemoryDocumentSessionOperations.js";
import { throwError } from "../../../src/Exceptions/index.js";
import { RavenCommand } from "../../../src/Http/RavenCommand.js";

export class DatabaseCommands implements IDisposable {
    private readonly _store: IDocumentStore;
    private readonly _requestExecutor: RequestExecutor;
    private readonly _session: InMemoryDocumentSessionOperations;

    public constructor(store: IDocumentStore, databaseName: string) {
        if (!store) {
            throwError("InvalidArgumentException", "Store cannot be null");
        }

        this._store = store;

        this._session = store.openSession(databaseName) as unknown as InMemoryDocumentSessionOperations;
        this._requestExecutor = store.getRequestExecutor(databaseName);
    }

    public get store() {
        return this._store;
    }

    public get requestExecutor() {
        return this._requestExecutor;
    }

    public get session() {
        return this._session;
    }

    public static forStore(store: IDocumentStore, databaseName?: string) {
        return new DatabaseCommands(store, databaseName);
    }

    public execute<TResult>(command: RavenCommand<TResult>) {
        return this._requestExecutor.execute(command);
    }

    dispose(): void {
        this._session.dispose()
    }
}