import { SecurityClearance } from "./SecurityClearance.js";
import { DatabaseAccess } from "./DatabaseAccess.js";

export interface CertificateMetadata {
    name: string;
    securityClearance: SecurityClearance;
    thumbprint: string;
    notAfter: Date;
    notBefore: Date;
    permissions?: Record<string, DatabaseAccess>;
    collectionSecondaryKeys?: string[];
    collectionPrimaryKey?: string;
    publicKeyPinningHash: string;
}
