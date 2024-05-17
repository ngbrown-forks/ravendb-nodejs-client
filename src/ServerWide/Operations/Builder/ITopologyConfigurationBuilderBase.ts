
export interface ITopologyConfigurationBuilderBase<TSelf> {
    addNode(nodeTag: string): TSelf;
    enableDynamicNodesDistribution(): TSelf;
}
