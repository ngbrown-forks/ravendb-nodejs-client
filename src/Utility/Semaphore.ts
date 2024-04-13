
const nextTick = function (fn: any) {
    setTimeout(fn, 0);
}

export class Semaphore {
    capacity = 1;
    current = 0;
    queue = [];
    firstHere = false;

    constructor(capacity = 1) {
        this.capacity = capacity;
    }

    take(func: () => void) {
        let isFirst: number;
        if (this.firstHere === false) {
            this.current++;
            this.firstHere = true;
            isFirst = 1;
        } else {
            isFirst = 0;
        }
        const item = { n: 1, task: func };

        if (this.current + item.n - isFirst > this.capacity) {
            if (isFirst === 1) {
                this.current--;
                this.firstHere = false;
            }
            return this.queue.push(item);
        }

        this.current += item.n - isFirst;
        item.task();
        if (isFirst === 1) {
            this.firstHere = false;
        }

    }

    leave(n: number = 1) {
        this.current -= n;

        if (!this.queue.length) {
            if (this.current < 0) {
                throw new Error('leave called too many times.');
            }

            return;
        }

        const item = this.queue[0];

        if (item.n + this.current > this.capacity) {
            return;
        }

        this.queue.shift();
        this.current += item.n;

        nextTick(item.task);
    }

    available(n: number = 1) {
        return this.current + n <= this.capacity;
    }
}
