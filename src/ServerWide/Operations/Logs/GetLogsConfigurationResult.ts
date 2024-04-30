import { LogMode } from "./LogMode.js";

export interface GetLogsConfigurationResult {
    currentMode: LogMode;
    mode: LogMode;
    path: string;
    useUtcTime: boolean;
    retentionTime: string;
    retentionSize: number;
    compress: boolean;
}