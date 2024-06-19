import { ICommandData, CommandType } from "../CommandData.js";
import { StringUtil } from "../../../Utility/StringUtil.js";
import { throwError } from "../../../Exceptions/index.js";
import { CounterOperationType } from "../../Operations/Counters/CounterOperationType.js";
import { DocumentCountersOperation } from "../../Operations/Counters/DocumentCountersOperation.js";
import { CounterOperation } from "../../Operations/Counters/CounterOperation.js";

export class CountersBatchCommandData implements ICommandData {
    private readonly _id: string;
    private readonly _name: string;
    private readonly _changeVector: string;
    private _fromEtl: boolean;
    private readonly _counters: DocumentCountersOperation;

    public constructor(documentId: string, counterOperation: CounterOperation);
    public constructor(documentId: string, counterOperations: CounterOperation[]);
    public constructor(documentId: string, counterOperations: CounterOperation | CounterOperation[]) {
        if (StringUtil.isNullOrWhitespace(documentId)) {
            throwError("InvalidArgumentException", "DocumentId cannot be null.");
        }

        if (!counterOperations) {
            throwError("InvalidArgumentException", "Argument 'counterOperations' cannot be null.");
        }

        this._id = documentId;
        this._name = null;
        this._changeVector = null;
        this._counters = new DocumentCountersOperation();
        this._counters.documentId = documentId;
        this._counters.operations = Array.isArray(counterOperations)
            ? counterOperations
            : [counterOperations];
    }

    public get id() {
        return this._id;
    }

    public get name() {
        return this._name;
    }

    public get changeVector() {
        return this._changeVector;
    }

    public get fromEtl() {
        return this._fromEtl;
    }

    public get counters() {
        return this._counters;
    }

    public get type(): CommandType {
        return "Counters";
    }

    public hasDelete(counterName: string): boolean {
        return this._hasOperationType("Delete", counterName);
    }

    public hasIncrement(counterName: string): boolean {
        return this._hasOperationType("Increment", counterName);
    }

    private _hasOperationType(type: CounterOperationType, counterName: string): boolean {
        for (const op of this._counters.operations) {
            if (counterName !== op.counterName) {
                continue;
            }

            if (op.type === type) {
                return true;
            }
        }

        return false;
    }

    public serialize(): object {
        return {
            Id: this._id,
            Counters: this._counters.serialize(),
            Type: "Counters",
            FromEtl: this._fromEtl || undefined
        };
    }
}
