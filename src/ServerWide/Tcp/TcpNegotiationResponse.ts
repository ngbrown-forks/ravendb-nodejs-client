import { LicensedFeatures } from "./LicensedFeatures.js";


export interface TcpNegotiationResponse {
    version: number;
    licensedFeatures: LicensedFeatures;
}
