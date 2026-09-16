// The MCP endpoint. Stateless Streamable HTTP with JSON responses: one McpServer per POST, scoped to the bearer token.
// Every tools/call is recorded by name, outcome, and latency (never arguments or results) for the Reports page.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Route } from "./+types/mcp";
import { prisma, now } from "~/lib/db.server";
import { authenticate } from "~/lib/mcp/auth.server";
import { buildServer } from "~/lib/mcp/server";
import type { TokenContext } from "~/lib/tokens.server";

type Rpc = { id?: unknown; method?: string; params?: { name?: string } };
type RpcResult = { id?: unknown; result?: { isError?: boolean }; error?: unknown };

function toolCallsIn(body: string): Array<{ id: unknown; tool: string }> {
  try {
    const parsed = JSON.parse(body) as Rpc | Rpc[];
    return (Array.isArray(parsed) ? parsed : [parsed])
      .filter((m) => m && m.method === "tools/call" && typeof m.params?.name === "string")
      .map((m) => ({ id: m.id, tool: m.params!.name! }));
  } catch {
    return [];
  }
}

async function recordToolCalls(ctx: TokenContext, calls: Array<{ id: unknown; tool: string }>, response: Response, ms: number) {
  let results: RpcResult[] = [];
  try {
    if ((response.headers.get("content-type") ?? "").includes("application/json")) {
      const parsed = (await response.clone().json()) as RpcResult | RpcResult[];
      results = Array.isArray(parsed) ? parsed : [parsed];
    }
  } catch {
    /* not JSON; treat as failed */
  }
  const ts = now();
  const rows = calls.map((c) => {
    const r = results.find((x) => x.id === c.id);
    const ok = Boolean(r && !r.error && !r.result?.isError);
    return { orgId: ctx.org.id, userId: ctx.user.id, handle: ctx.membership.handle, tokenId: ctx.token.id, tool: c.tool, ok, ms, createdAt: ts };
  });
  if (rows.length) await prisma().toolCall.createMany({ data: rows });
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const body = await request.text();
  const calls = toolCallsIn(body);
  const server = buildServer(auth);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  const started = Date.now();
  try {
    const response = await transport.handleRequest(new Request(request.url, { method: "POST", headers: request.headers, body }));
    if (calls.length) void recordToolCalls(auth, calls, response, Date.now() - started).catch((e) => console.warn(`[reedright] tool call log skipped: ${(e as Error).message}`));
    return response;
  } finally {
    void server.close().catch(() => {});
  }
}

export async function loader() {
  return new Response("Method Not Allowed. POST JSON-RPC to this endpoint with Accept: application/json, text/event-stream.", { status: 405, headers: { Allow: "POST" } });
}
