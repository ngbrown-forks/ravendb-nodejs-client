import { QueueBrokerType } from "../Etl/ConnectionString.js";
import { QueueSinkScript } from "./QueueSinkScript.js";

export interface QueueSinkConfiguration {
    brokerType: QueueBrokerType;
    taskId?: number;
    disabled?: boolean;
    name: string;
    mentorName?: string;
    pinToMentorNode?: boolean;
    connectionStringName: string;
    scripts: QueueSinkScript[];
}
