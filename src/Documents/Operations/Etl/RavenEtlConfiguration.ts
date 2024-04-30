import { EtlConfiguration } from "./EtlConfiguration.js";
import { RavenConnectionString, EtlType } from "./ConnectionString.js";
import { DocumentConventions } from "../../Conventions/DocumentConventions.js";

export class RavenEtlConfiguration extends EtlConfiguration<RavenConnectionString> {
    public loadRequestTimeoutInSec: number;

    public get etlType(): EtlType {
        return "Raven";
    }

    serialize(conventions: DocumentConventions): object {
        const result = super.serialize(conventions) as any;
        result.EtlType = this.etlType;
        return result;
    }
}