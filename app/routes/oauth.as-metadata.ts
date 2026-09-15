// RFC 8414 authorization server metadata.
import { authorizationServerMetadata, corsHeaders } from "~/lib/oauth.server";

export async function loader() {
  return Response.json(authorizationServerMetadata(), { headers: corsHeaders({ "Cache-Control": "public, max-age=300" }) });
}

export async function action() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
