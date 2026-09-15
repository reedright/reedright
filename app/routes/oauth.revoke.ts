// RFC 7009 token revocation.
import type { Route } from "./+types/oauth.revoke";
import { OAuthError, corsHeaders, formFromRequest, jsonNoStore, revokeEndpoint } from "~/lib/oauth.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST, OPTIONS" } });
  try {
    await revokeEndpoint(await formFromRequest(request), request.headers.get("authorization"));
    return new Response(null, { status: 200, headers: corsHeaders({ "Cache-Control": "no-store" }) });
  } catch (e) {
    if (e instanceof OAuthError) return jsonNoStore(e.toJSON(), e.status);
    return jsonNoStore({ error: "server_error", error_description: "unexpected error" }, 500);
  }
}

export async function loader() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST, OPTIONS" } });
}
