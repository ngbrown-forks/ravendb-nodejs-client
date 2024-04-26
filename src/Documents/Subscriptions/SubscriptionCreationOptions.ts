import { DocumentType } from "../DocumentAbstractions.js";
import { ISubscriptionIncludeBuilder } from "../Session/Loaders/ISubscriptionIncludeBuilder.js";

export interface SubscriptionCreationOptions {
    name?: string;
    query?: string;
    includes?: (builder: ISubscriptionIncludeBuilder) => void;
    changeVector?: string;
    mentorNode?: string;
    disabled?: boolean;
    documentType?: DocumentType;
}
