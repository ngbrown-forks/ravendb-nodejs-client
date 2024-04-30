import { CounterOperation } from "./CounterOperation.js";

export class DocumentCountersOperation {
    public operations: CounterOperation[];

    public documentId: string;

    public serialize(): object {
        const result = {
            DocumentId: this.documentId,
            Operations: this.operations.map(op => op.serialize())
        };

        return result;
    }
}
