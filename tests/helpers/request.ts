import { NextRequest } from "next/server";

type Params = Record<string, string | string[]>;

type RouteHandler<P extends Params> = (
  request: NextRequest,
  context: { params: Promise<P> },
) => Response | Promise<Response>;

type CallOptions<P extends Params> = {
  method?: string;
  path?: string;
  /** Sent as JSON unless it is already a string. */
  body?: unknown;
  headers?: Record<string, string>;
  /** The dynamic route segments, e.g. `{ id }` for `/api/posts/[id]`. */
  params?: P;
};

export type CallResult<T = unknown> = {
  status: number;
  headers: Headers;
  body: T;
};

/**
 * Calls a route handler the way Next would: a real Request in, a real
 * Response out, with the JSON body parsed for assertions.
 */
// Tests assert on arbitrary JSON paths, so the body defaults to `any`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function call<T = any, P extends Params = Params>(
  handler: RouteHandler<P>,
  { method = "GET", path = "/", body, headers = {}, params = {} as P }: CallOptions<P> = {},
): Promise<CallResult<T>> {
  const init: RequestInit = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    (init.headers as Record<string, string>)["content-type"] ??= "application/json";
  }
  const request = new NextRequest(new URL(path, "http://localhost"), init as never);
  const response = await handler(request, { params: Promise.resolve(params) });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: (text ? JSON.parse(text) : null) as T,
  };
}
