// OAuth token endpoint: authorization_code (PKCE) and refresh_token grants.
import type { Route } from "./+types/oauth.token";
import { OAuthError, corsHeaders, formFromRequest, jsonNoStore, tokenEndpoint } from "~/lib/oauth.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST, OPTIONS" } });
  try {
    return jsonNoStore(await tokenEndpoint(await formFromRequest(request), request.headers.get("authorization")));
  } catch (e) {
    if (e instanceof OAuthError) return jsonNoStore(e.toJSON(), e.status);
    console.error("[oauth/token]", e);
    return jsonNoStore({ error: "server_error", error_description: "unexpected error" }, 500);
  }
}

export async function loader() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST, OPTIONS" } });
}
