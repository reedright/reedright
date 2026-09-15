import { bearerFromRequest, resolveToken, type TokenContext } from "../tokens.server";

function unauthorized(description: string): Response {
  return Response.json(
    { error: "unauthorized", message: `${description}. Mint a token on your reedright Tokens page and send it as Authorization: Bearer <token>.` },
    { status: 401, headers: { "WWW-Authenticate": `Bearer realm="reedright", error="invalid_token", error_description="${description}"` } },
  );
}

export async function authenticate(request: Request): Promise<TokenContext | Response> {
  const bearer = bearerFromRequest(request);
  if (!bearer) return unauthorized("Missing bearer token");
  const ctx = await resolveToken(bearer);
  if (!ctx) return unauthorized("Invalid or revoked token");
  return ctx;
}
