import { CertificateMetadata } from "./CertificateMetadata.js";

export interface CertificateDefinition extends CertificateMetadata {
    certificate: string;
    password?: string;
}

