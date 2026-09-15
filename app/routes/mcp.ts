// The MCP endpoint. Stateless Streamable HTTP with JSON responses: one McpServer per POST, scoped to the bearer token.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Route } from "./+types/mcp";
import { authenticate } from "~/lib/mcp/auth.server";
import { buildServer } from "~/lib/mcp/server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const server = buildServer(auth);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    void server.close().catch(() => {});
  }
}

export async function loader() {
  return new Response("Method Not Allowed. POST JSON-RPC to this endpoint with Accept: application/json, text/event-stream.", { status: 405, headers: { Allow: "POST" } });
}
