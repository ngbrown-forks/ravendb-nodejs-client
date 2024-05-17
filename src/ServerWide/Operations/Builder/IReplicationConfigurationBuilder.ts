import { ExternalReplication } from "../../../Documents/Replication/ExternalReplication.js";
import { PullReplicationAsSink } from "../../../Documents/Operations/Replication/PullReplicationAsSink.js";
import { PullReplicationDefinition } from "../../../Documents/Operations/Replication/PullReplicationDefinition.js";

export interface IReplicationConfigurationBuilder {
    addExternalReplication(configuration: ExternalReplication): this;
    addPullReplicationSink(configuration: PullReplicationAsSink): this;
    addPullReplicationHub(configuration: PullReplicationDefinition): this;
}
