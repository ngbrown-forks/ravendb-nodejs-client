import {RavenCommand} from "../../Http/RavenCommand";
import {ServerNode} from "../../Http/ServerNode";
import {StatusCodes} from "../../Http/StatusCode";
import {StringUtil} from "../../Utility/StringUtil";
import {Topology} from "../../Http/Topology";
import { HttpRequestBase, HttpResponse } from "../../Primitives/Http";

interface ServerNodeDto {
  database: string;
  url: string;
  clusterTag?: string;
  serverRole: string;
}

interface TopologyDto {
  etag: number;
  nodes?: ServerNodeDto[];
}

export class GetDatabaseTopologyCommand extends RavenCommand<Topology> {

  public createRequest(node: ServerNode): HttpRequestBase {
        let uri = `${node.url}/topology?name=${node.database}`;

        if (node.url.toLowerCase().indexOf(".fiddler") !== -1) {
            // we want to keep the '.fiddler' stuff there so we'll keep tracking request
            // so we are going to ask the server to respect it
            uri += "&localUrl=" + encodeURIComponent(node.url);
        }

        return { uri };
  }

  public setResponse(response: string, fromCache: boolean): void {
    if (!response) {
      return;
    }

    const rawTpl: TopologyDto = JSON.parse(response);
    const nodes = rawTpl.nodes
      ? rawTpl.nodes.map(x => Object.assign(new ServerNode(), x))
      : null;
    this.result = new Topology(
      rawTpl.etag, 
      nodes);
  }

  public get isReadRequest(): boolean {
    return true;
  }
}
