import { IDisposable } from "../../Types/Contracts.js";
import { DocumentStore } from "../DocumentStore.js";

import { AbstractSubscriptionWorker } from "./AbstractSubscriptionWorker.js";
import { SubscriptionBatch } from "./SubscriptionBatch.js";
import { SubscriptionWorkerOptions } from "./SubscriptionWorkerOptions.js";
import { IRequestExecutorOptions, RequestExecutor } from "../../Http/RequestExecutor.js";

export class SubscriptionWorker<T extends object> extends AbstractSubscriptionWorker<SubscriptionBatch<T>, T> implements IDisposable {

    private readonly _store: DocumentStore;

    public constructor(options: SubscriptionWorkerOptions<T>,
                       withRevisions: boolean, documentStore: DocumentStore, dbName: string) {
        super(options, withRevisions, documentStore.getEffectiveDatabase(dbName));

        this._store = documentStore;
    }

    protected getRequestExecutor(): RequestExecutor {
        return this._store.getRequestExecutor(this._dbName);
    }

    protected setLocalRequestExecutor(url: string, opts: IRequestExecutorOptions) {
        if (this._subscriptionLocalRequestExecutor) {
            this._subscriptionLocalRequestExecutor.dispose();
        }

        this._subscriptionLocalRequestExecutor = RequestExecutor.createForSingleNodeWithoutConfigurationUpdates(url, this._dbName, opts);

        this._store.registerEvents(this._subscriptionLocalRequestExecutor);
    }

    protected createEmptyBatch(): SubscriptionBatch<T> {
        return new SubscriptionBatch<T>(this._documentType, this._revisions,
            this._subscriptionLocalRequestExecutor, this._store, this._dbName);
    }

    protected trySetRedirectNodeOnConnectToServer() {
        // no-op
    }
}
