
export type HttpRequestParameters = RequestInit & {
  uri: string;
  fetcher?: any;
};
export type HttpRequestParametersWithoutUri = RequestInit & {
  fetcher?: any;
};
export type HttpResponse = Response;
export type HttpRequest = Request;
