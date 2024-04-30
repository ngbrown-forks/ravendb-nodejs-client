import { RestoreBackupConfigurationBase } from "./RestoreBackupConfigurationBase.js";
import { AzureSettings } from "./AzureSettings.js";

export interface RestoreFromAzureConfiguration extends RestoreBackupConfigurationBase {
    settings: AzureSettings;
    type: "Azure";
}