import { SubscriptionCreationOptions } from "./SubscriptionCreationOptions.js";

export interface SubscriptionUpdateOptions extends SubscriptionCreationOptions {
    id?: number;
    createNew?: boolean;
}