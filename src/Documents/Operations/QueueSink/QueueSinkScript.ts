
export interface QueueSinkScript {
    name?: string;
    queues: string[];
    script: string;
    disabled?: boolean;
}
