// RFC 7591 dynamic client registration.
import type { Route } from "./+types/oauth.register";
import { OAuthError, corsHeaders, jsonNoStore, registerClient } from "~/lib/oauth.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST, OPTIONS" } });
  try {
    const body = await request.json();
    return jsonNoStore(await registerClient(body), 201);
  } catch (e) {
    if (e instanceof OAuthError) return jsonNoStore(e.toJSON(), e.status);
    return jsonNoStore({ error: "invalid_client_metadata", error_description: "request body must be a JSON client metadata object" }, 400);
  }
}

export async function loader() {
  return new Response("POST a client metadata JSON document here to register (RFC 7591).", { status: 405, headers: { Allow: "POST, OPTIONS" } });
}
