// RFC 9728 protected resource metadata for the MCP endpoint. Served at /.well-known/oauth-protected-resource and .../mcp.
import { corsHeaders, protectedResourceMetadata } from "~/lib/oauth.server";

export async function loader() {
  return Response.json(protectedResourceMetadata(), { headers: corsHeaders({ "Cache-Control": "public, max-age=300" }) });
}

export async function action() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
