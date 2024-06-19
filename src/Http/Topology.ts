import { ServerNode } from "./ServerNode.js";

export class Topology {
    public etag: number = 0;
    public nodes?: ServerNode[] = null;
    public promotables?: ServerNode[] = null;

    constructor(etag: number = 0, nodes: ServerNode[] = null, promotables: ServerNode[] = null) {
        this.etag = etag;
        this.nodes = nodes || [];
        this.promotables = promotables || [];
    }
}
