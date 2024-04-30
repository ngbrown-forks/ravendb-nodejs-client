import { SubscriptionState } from "./SubscriptionState.js";
import { NodeId } from "./NodeId.js";

export interface SubscriptionStateWithNodeDetails extends SubscriptionState {
    responsibleNode: NodeId;
}
