import { ServerNode } from "./ServerNode.js";

export interface CurrentIndexAndNodeAndEtag {
    currentIndex: number;
    currentNode: ServerNode;
    topologyEtag: number;
}