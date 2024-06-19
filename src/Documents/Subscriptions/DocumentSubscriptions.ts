import { IDisposable } from "../../Types/Contracts.js";
import { DocumentStore } from "../DocumentStore.js";
import { SubscriptionCreationOptions } from "./SubscriptionCreationOptions.js";
import { DocumentType } from "../DocumentAbstractions.js";
import { TypeUtil } from "../../Utility/TypeUtil.js";
import { throwError } from "../../Exceptions/index.js";
import { CreateSubscriptionCommand } from "../Commands/CreateSubscriptionCommand.js";
import { SubscriptionWorkerOptions } from "./SubscriptionWorkerOptions.js";
import { Revision } from "./Revision.js";
import { SubscriptionState } from "./SubscriptionState.js";
import { SubscriptionWorker } from "./SubscriptionWorker.js";
import { DeleteSubscriptionCommand } from "../Commands/DeleteSubscriptionCommand.js";
import { StringUtil } from "../../Utility/StringUtil.js";
import { GetSubscriptionStateCommand } from "../Commands/GetSubscriptionStateCommand.js";
import { DropSubscriptionConnectionCommand } from "../Commands/DropSubscriptionConnectionCommand.js";
import { GetSubscriptionsCommand } from "../Commands/GetSubscriptionsCommand.js";
import { ToggleOngoingTaskStateOperation } from "../Operations/OngoingTasks/ToggleOngoingTaskStateOperation.js";
import { SubscriptionIncludeBuilder } from "../Session/Loaders/SubscriptionIncludeBuilder.js";
import { IncludesUtil } from "../Session/IncludesUtil.js";
import { StringBuilder } from "../../Utility/StringBuilder.js";
import { SubscriptionUpdateOptions } from "./SubscriptionUpdateOptions.js";
import { UpdateSubscriptionCommand } from "../Commands/UpdateSubscriptionCommand.js";
import { CounterIncludesToken } from "../Session/Tokens/CounterIncludesToken.js";
import { TimeSeriesIncludesToken } from "../Session/Tokens/TimeSeriesIncludesToken.js";
import { QueryToken } from "../Session/Tokens/QueryToken.js";
import { EOL } from "../../Utility/OsUtil.js";

const INCLUDE_REVISIONS_RQL = " (Revisions = true)";

export class DocumentSubscriptions implements IDisposable {
    private readonly _store: DocumentStore;
    private readonly _subscriptions: Map<IDisposable, boolean> = new Map();

    public constructor(store: DocumentStore) {
        this._store = store;
    }

    /**
     * Creates a data subscription in a database. The subscription will expose all
     * documents that match the specified subscription options for a given type.
     */
    public async create(options: SubscriptionCreationOptions): Promise<string>;

    /**
     * Creates a data subscription in a database. The subscription will expose all
     * documents that match the specified subscription options for a given type.
     */
    public async create(options: SubscriptionCreationOptions, database: string): Promise<string>;

    /**
     * Creates a data subscription in a database. The subscription will expose all
     * documents that match the specified subscription options for a given type.
     */
    public async create(documentType: DocumentType): Promise<string>;

    /**
     * Creates a data subscription in a database. The subscription will expose all
     * documents that match the specified subscription options for a given type.
     */
    public async create(optionsOrDocumentType: SubscriptionCreationOptions | DocumentType,
                        database?: string): Promise<string> {

        let options: SubscriptionCreationOptions = null;
        if (TypeUtil.isDocumentType(optionsOrDocumentType)) {
            options = {
                documentType: optionsOrDocumentType as DocumentType<any>
            };
            return this.create(this._ensureCriteria(options, false), database);
        } else {
            options = this._ensureCriteria(optionsOrDocumentType as SubscriptionCreationOptions, false);
        }

        if (!options) {
            throwError("InvalidArgumentException", "Cannot create a subscription if options are null");
        }

        if (!options.query) {
            throwError("InvalidArgumentException", "Cannot create a subscription if the script is null");
        }

        const requestExecutor = this._store.getRequestExecutor(this._store.getEffectiveDatabase(database));

        const command = new CreateSubscriptionCommand(options);
        await requestExecutor.execute(command);

        return command.result.name;
    }

    /**
     * Creates a data subscription in a database. The subscription will expose all documents
     * that match the specified subscription options for a given type.
     */
    public createForRevisions(options: SubscriptionCreationOptions): Promise<string>;

    /**
     * Creates a data subscription in a database. The subscription will expose all documents
     * that match the specified subscription options for a given type.
     */
    public createForRevisions(options: SubscriptionCreationOptions, database: string): Promise<string>;

    /**
     * Creates a data subscription in a database. The subscription will expose all documents
     * that match the specified subscription options for a given type.
     */
    public createForRevisions(options: SubscriptionCreationOptions, database?: string): Promise<string> {
        options = options || {} as SubscriptionCreationOptions;

        return this.create(this._ensureCriteria(options, true), database);
    }

    private _ensureCriteria<T extends object>(
        criteria: SubscriptionCreationOptions, revisions: boolean) {
        if (!criteria) {
            criteria = {} as SubscriptionCreationOptions;
        }

        const objectDescriptor = this._store.conventions.getJsTypeByDocumentType(criteria.documentType);
        const collectionName = this._store.conventions.getCollectionNameForType(objectDescriptor);
        let queryBuilder: StringBuilder;

        if (criteria.query) {
            queryBuilder = new StringBuilder(criteria.query);
        } else {
            queryBuilder = new StringBuilder("from '");
            StringUtil.escapeString(queryBuilder, collectionName);
            queryBuilder.append("'");

            if (revisions) {
                queryBuilder.append(INCLUDE_REVISIONS_RQL);
            }

            queryBuilder.append(" as doc");
        }

        if (criteria.includes) {
            const builder = new SubscriptionIncludeBuilder(this._store.conventions);
            criteria.includes(builder);

            let numberOfIncludesAdded = 0;

            if (builder.documentsToInclude && builder.documentsToInclude.size) {
                queryBuilder.append(EOL + "include ");

                for (const inc of builder.documentsToInclude) {
                    const include = "doc." + inc;
                    if (numberOfIncludesAdded > 0) {
                        queryBuilder.append(",");
                    }

                    let escapedInclude: string;
                    if (IncludesUtil.requiresQuotes(include, x => escapedInclude = x)) {
                        queryBuilder
                            .append("'")
                            .append(escapedInclude)
                            .append("'");
                    } else {
                        queryBuilder
                            .append(QueryToken.isKeyword(include) ? "'" + include + "'" : include);
                    }

                    numberOfIncludesAdded++;
                }
            }

            if (builder.isAllCounters) {
                if (!numberOfIncludesAdded) {
                    queryBuilder
                        .append(EOL)
                        .append("include ");
                }

                const token = CounterIncludesToken.all("");
                token.writeTo(queryBuilder);
                numberOfIncludesAdded++;
            } else if (builder.countersToInclude && builder.countersToInclude.size) {
                if (!numberOfIncludesAdded) {
                    queryBuilder
                        .append(EOL)
                        .append("include ");
                }

                for (const counterName of builder.countersToInclude) {
                    if (numberOfIncludesAdded > 0) {
                        queryBuilder.append(",");
                    }

                    const token = CounterIncludesToken.create("", counterName);
                    token.writeTo(queryBuilder);

                    numberOfIncludesAdded++;
                }
            }

            if (builder.timeSeriesToInclude) {
                for (const timeSeriesRange of builder.timeSeriesToInclude) {
                    if (numberOfIncludesAdded === 0) {
                        queryBuilder
                            .append(EOL)
                            .append("include ");
                    }

                    if (numberOfIncludesAdded > 0) {
                        queryBuilder.append(",");
                    }

                    const token = TimeSeriesIncludesToken.create("", timeSeriesRange)
                    token.writeTo(queryBuilder);

                    numberOfIncludesAdded++;
                }
            }
        }

        criteria.query = queryBuilder.toString();

        return criteria;
    }

    /**
     * It opens a subscription and starts pulling documents since a last processed document for that subscription.
     * The connection options determine client and server cooperation rules like document batch sizes
     * or a timeout in a matter of which a client needs to acknowledge that batch has been processed.
     * The acknowledgment is sent after all documents are processed by subscription's handlers.
     *
     * There can be only a single client that is connected to a subscription.
     */
    public getSubscriptionWorker<T extends object>(
        options: SubscriptionWorkerOptions<T>): SubscriptionWorker<T>;

    /**
     * It opens a subscription and starts pulling documents since a last processed document for that subscription.
     * The connection options determine client and server cooperation rules like document batch sizes
     * or a timeout in a matter of which a client needs to acknowledge that batch has been processed.
     * The acknowledgment is sent after all documents are processed by subscription's handlers.
     *
     * There can be only a single client that is connected to a subscription.
     */
    public getSubscriptionWorker<T extends object>(
        options: SubscriptionWorkerOptions<T>, database: string): SubscriptionWorker<T>;

    /**
     * It opens a subscription and starts pulling documents since a last processed document for that subscription.
     * The connection options determine client and server cooperation rules like document batch sizes
     * or a timeout in a matter of which a client needs to acknowledge that batch has been processed.
     * The acknowledgment is sent after all documents are processed by subscription's handlers.
     *
     * There can be only a single client that is connected to a subscription.
     */
    public getSubscriptionWorker<T extends object>(
        subscriptionName: string): SubscriptionWorker<T>;

    /**
     * It opens a subscription and starts pulling documents since a last processed document for that subscription.
     * The connection options determine client and server cooperation rules like document batch sizes
     * or a timeout in a matter of which a client needs to acknowledge that batch has been processed.
     * The acknowledgment is sent after all documents are processed by subscription's handlers.
     *
     * There can be only a single client that is connected to a subscription.
     */
    public getSubscriptionWorker<T extends object>(
        subscriptionName: string, database: string): SubscriptionWorker<T>;

    /**
     * It opens a subscription and starts pulling documents since a last processed document for that subscription.
     * The connection options determine client and server cooperation rules like document batch sizes
     * or a timeout in a matter of which a client needs to acknowledge that batch has been processed.
     * The acknowledgment is sent after all documents are processed by subscription's handlers.
     *
     * There can be only a single client that is connected to a subscription.
     */
    public getSubscriptionWorker<T extends object>(
        optionsOrSubscriptionName: SubscriptionWorkerOptions<T> | string,
        database?: string): SubscriptionWorker<T> {

        if (TypeUtil.isString(optionsOrSubscriptionName)) {
            return this.getSubscriptionWorker({
                subscriptionName: optionsOrSubscriptionName
            }, database);
        }

        const options: SubscriptionWorkerOptions<T> = optionsOrSubscriptionName;
        this._store.assertInitialized();

        if (!options) {
            throwError("InvalidArgumentException", "Cannot open a subscription if options are null");
        }

        const subscription = new SubscriptionWorker(options, false, this._store, database);
        subscription.on("end", () => this._subscriptions.delete(subscription));
        this._subscriptions.set(subscription, true);

        return subscription;
    }

    /**
     * It opens a subscription and starts pulling documents since a last processed document for that subscription.
     * The connection options determine client and server cooperation rules like document batch sizes
     * or a timeout in a matter of which a client needs to acknowledge that batch has been processed.
     * The acknowledgment is sent after all documents are processed by subscription's handlers.
     *
     * There can be only a single client that is connected to a subscription.
     */
    public getSubscriptionWorkerForRevisions<T extends object>(
        options: SubscriptionWorkerOptions<T>): SubscriptionWorker<Revision<T>>;

    /**
     * It opens a subscription and starts pulling documents since a last processed document for that subscription.
     * The connection options determine client and server cooperation rules like document batch sizes
     * or a timeout in a matter of which a client needs to acknowledge that batch has been processed.
     * The acknowledgment is sent after all documents are processed by subscription's handlers.
     *
     * There can be only a single client that is connected to a subscription.
     */
    public getSubscriptionWorkerForRevisions<T extends object>(
        options: SubscriptionWorkerOptions<T>, database: string): SubscriptionWorker<Revision<T>>;

    /**
     * It opens a subscription and starts pulling documents since a last processed document for that subscription.
     * The connection options determine client and server cooperation rules like document batch sizes
     * or a timeout in a matter of which a client needs to acknowledge that batch has been processed.
     * The acknowledgment is sent after all documents are processed by subscription's handlers.
     *
     * There can be only a single client that is connected to a subscription.
     */
    public getSubscriptionWorkerForRevisions<T extends object>(
        optionsOrSubscriptionName: SubscriptionWorkerOptions<T> | string,
        database?: string): SubscriptionWorker<Revision<T>> {

        if (TypeUtil.isString(optionsOrSubscriptionName)) {
            return this.getSubscriptionWorkerForRevisions({
                subscriptionName: optionsOrSubscriptionName,
            } as SubscriptionWorkerOptions<T>, database);
        }

        const options: SubscriptionWorkerOptions<T> = optionsOrSubscriptionName;
        const subscription = new SubscriptionWorker<Revision<T>>(
            options as any as SubscriptionWorkerOptions<Revision<T>>, true, this._store, database);

        subscription.on("end", () => this._subscriptions.delete(subscription));
        this._subscriptions.set(subscription, true);

        return subscription;
    }

    /**
     * It downloads a list of all existing subscriptions in a database.
     */
    public async getSubscriptions(start: number, take: number): Promise<SubscriptionState[]>;

    /**
     * It downloads a list of all existing subscriptions in a database.
     */
    public async getSubscriptions(start: number, take: number, database: string): Promise<SubscriptionState[]>;

    /**
     * It downloads a list of all existing subscriptions in a database.
     */
    public async getSubscriptions(start: number, take: number, database?: string): Promise<SubscriptionState[]> {
        const requestExecutor = this._store.getRequestExecutor(this._store.getEffectiveDatabase(database));

        const command = new GetSubscriptionsCommand(start, take);
        await requestExecutor.execute(command);

        return command.result;
    }

    /**
     * Delete a subscription.
     */
    public async delete(name: string): Promise<void>;

    /**
     * Delete a subscription.
     */
    public async delete(name: string, database: string): Promise<void>;

    /**
     * Delete a subscription.
     */
    public async delete(name: string, database?: string): Promise<void> {
        const requestExecutor = this._store.getRequestExecutor(this._store.getEffectiveDatabase(database));

        const command = new DeleteSubscriptionCommand(name);
        return requestExecutor.execute(command);
    }

    /**
     * Returns subscription definition and it's current state
     */
    public async getSubscriptionState(subscriptionName: string): Promise<SubscriptionState>;

    /**
     * Returns subscription definition and it's current state
     */
    public async getSubscriptionState(subscriptionName: string, database: string): Promise<SubscriptionState>;

    /**
     * Returns subscription definition and it's current state
     */
    public async getSubscriptionState(subscriptionName: string, database?: string): Promise<SubscriptionState> {
        if (StringUtil.isNullOrEmpty(subscriptionName)) {
            throwError("InvalidArgumentException", "SubscriptionName cannot be null");
        }

        const requestExecutor = this._store.getRequestExecutor(this._store.getEffectiveDatabase(database));

        const command = new GetSubscriptionStateCommand(subscriptionName);
        await requestExecutor.execute(command);
        return command.result;
    }

    public dispose(): void {
        if (!this._subscriptions.size) {
            return;
        }

        for (const [key, value] of this._subscriptions.entries()) key.dispose();
    }

    public async dropSubscriptionWorker<T extends object>(worker: SubscriptionWorker<T>, database: string = null) {
        database ??= this._store.database;

        const requestExecutor = this._store.getRequestExecutor(database);
        const command = new DropSubscriptionConnectionCommand(worker.subscriptionName, worker.getWorkerId());

        await requestExecutor.execute(command);
    }

    /**
     * Force server to close all current client subscription connections to the server
     */
    public async dropConnection(name: string): Promise<void>;

    /**
     * Force server to close all current client subscription connections to the server
     */
    public async dropConnection(name: string, database: string): Promise<void>;

    /**
     * Force server to close all current client subscription connections to the server
     */
    public async dropConnection(name: string, database?: string): Promise<void> {
        const requestExecutor = this._store.getRequestExecutor(this._store.getEffectiveDatabase(database));

        const command = new DropSubscriptionConnectionCommand(name);
        return requestExecutor.execute(command);
    }

    public async enable(name: string)
    public async enable(name: string, database: string)
    public async enable(name: string, database?: string) {
        const operation = new ToggleOngoingTaskStateOperation(name, "Subscription", false);
        await this._store.maintenance.forDatabase(this._store.getEffectiveDatabase(database))
            .send(operation);
    }

    public async disable(name: string)
    public async disable(name: string, database: string)
    public async disable(name: string, database?: string) {
        const operation = new ToggleOngoingTaskStateOperation(name, "Subscription", true);
        await this._store.maintenance.forDatabase(this._store.getEffectiveDatabase(database))
            .send(operation);
    }

    public async update(options: SubscriptionUpdateOptions): Promise<string>;
    public async update(options: SubscriptionUpdateOptions, database: string): Promise<string>;
    public async update(options: SubscriptionUpdateOptions, database?: string): Promise<string> {
        if (!options) {
            throwError("InvalidArgumentException", "Cannot update a subscription if options is null");
        }

        if (StringUtil.isNullOrEmpty(options.name) && !options.id) {
            throwError("InvalidArgumentException", "Cannot update a subscription if both options.name and options.if are null");
        }

        const requestExecutor = this._store.getRequestExecutor(database);
        const command = new UpdateSubscriptionCommand(options);
        await requestExecutor.execute(command, null);

        return command.result.name;
    }
}
