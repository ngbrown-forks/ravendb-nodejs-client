import { TcpConnectionStatus } from "./TcpConnectionStatus.js";
import { LicensedFeatures } from "./LicensedFeatures.js";

export interface TcpConnectionHeaderResponse {
    status: TcpConnectionStatus;
    message: string;
    version: number;
    licensedFeatures: LicensedFeatures;
}
