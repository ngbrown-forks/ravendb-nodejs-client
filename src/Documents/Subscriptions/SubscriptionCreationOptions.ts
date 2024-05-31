import { DocumentType } from "../DocumentAbstractions.js";
import { ISubscriptionIncludeBuilder } from "../Session/Loaders/ISubscriptionIncludeBuilder.js";
import { ArchivedDataProcessingBehavior } from "../DataArchival/ArchivedDataProcessingBehavior.js";

export interface SubscriptionCreationOptions {
    name?: string;
    query?: string;
    includes?: (builder: ISubscriptionIncludeBuilder) => void;
    changeVector?: string;
    mentorNode?: string;
    pinToMentorNode?: boolean;
    archivedDataProcessingBehavior?: ArchivedDataProcessingBehavior;
    disabled?: boolean;
    documentType?: DocumentType;
}
