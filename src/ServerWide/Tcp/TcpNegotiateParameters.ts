import { AuthorizationInfo, OperationTypes } from "./TcpConnectionHeaderMessage.js";
import { Socket } from "node:net";
import { TcpNegotiationResponse } from "./TcpNegotiationResponse.js";
import { LicensedFeatures } from "./LicensedFeatures.js";

export interface TcpNegotiateParameters {
    operation: OperationTypes;
    authorizeInfo?: AuthorizationInfo;
    version: number;
    database: string;
    sourceNodeTag?: string;
    destinationNodeTag: string;
    destinationUrl: string;
    destinationServerId: string;
    licensedFeatures: LicensedFeatures;
    readResponseAndGetVersionCallback: (url: string, socket: Socket) => Promise<TcpNegotiationResponse>;
}
