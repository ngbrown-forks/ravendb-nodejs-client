import { RestoreBackupConfigurationBase } from "./RestoreBackupConfigurationBase.js";
import { GoogleCloudSettings } from "./GoogleCloudSettings.js";

export interface RestoreFromGoogleCloudConfiguration extends RestoreBackupConfigurationBase {
    settings: GoogleCloudSettings;
    type: "GoogleCloud";
}