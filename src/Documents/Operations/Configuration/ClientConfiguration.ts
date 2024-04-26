import { ReadBalanceBehavior } from "../../../Http/ReadBalanceBehavior.js";
import { LoadBalanceBehavior } from "../../../Http/LoadBalanceBehavior.js";

export interface ClientConfiguration {
    identityPartsSeparator?: string;
    etag?: number;
    disabled?: boolean;
    maxNumberOfRequestsPerSession?: number;
    readBalanceBehavior?: ReadBalanceBehavior;
    loadBalanceBehavior?: LoadBalanceBehavior;
    loadBalancerContextSeed?: number;
}
