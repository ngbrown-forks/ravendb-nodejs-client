import { StudioEnvironment } from "./StudioEnvironment.js";

export interface StudioConfiguration {
    disabled: boolean;
    disableAutoIndexCreation: boolean;
    environment: StudioEnvironment;

}
