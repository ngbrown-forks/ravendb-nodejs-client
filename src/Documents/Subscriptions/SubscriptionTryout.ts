import { ArchivedDataProcessingBehavior } from "../DataArchival/ArchivedDataProcessingBehavior.js";

export interface SubscriptionTryout {
    changeVector: string;
    query: string;
    archivedDataProcessingBehavior: ArchivedDataProcessingBehavior;
}
