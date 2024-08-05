import { StreamBase } from './StreamBase.js';

export class StreamValues extends StreamBase {
    static make(options) {
        return new StreamValues(options);
    }

    static streamValues = StreamValues.make;

    _counter: any;

    constructor(options = undefined) {
        super(options);
        this._counter = 0;
        this._level = 0;
    }

    _push(discard) {
        if (discard) {
            ++this._counter;
        } else {
            this.push({key: this._counter++, value: this._assembler.current});
        }
        this._assembler.current = this._assembler.key = null;
    }
}
