import { AmazonSettings } from "./AmazonSettings.js";

export interface GlacierSettings extends AmazonSettings {
    vaultName: string;
}