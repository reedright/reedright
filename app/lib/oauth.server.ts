// OAuth 2.1 authorization server for MCP clients (claude.ai connectors, Claude Code, etc.).
// Supports PKCE (S256), dynamic client registration (RFC 7591), Client ID Metadata Documents (client_id is an
// https URL hosting the client's metadata), refresh tokens with rotation, and RFC 8707 resource indicators.
// An access token is an ApiToken row of kind "oauth", so the MCP endpoint needs no changes.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { OAuthClientMetadataSchema } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { OAuthClient } from "../../generated/prisma/client";
import { prisma, now } from "./db.server";
import { env } from "./env.server";
import { hashToken, mintToken } from "./tokens.server";

export const SCOPES = ["brain"]; // access is scoped by (user, org); the scope string is informational
const CODE_TTL_MS = 10 * 60_000;
const ACCESS_TTL_S = 7 * 24 * 3600;
const REFRESH_TTL_MS = 90 * 24 * 3600_000;
const CIMD_CACHE_MS = 3600_000;

export const issuer = () => env.APP_URL;
export const resourceUrl = () => `${env.APP_URL}/mcp`;

export class OAuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
  toJSON() {
    return { error: this.code, error_description: this.message };
  }
}

export function authorizationServerMetadata() {
  const i = issuer();
  return {
    issuer: i,
    authorization_endpoint: `${i}/oauth/authorize`,
    token_endpoint: `${i}/oauth/token`,
    registration_endpoint: `${i}/oauth/register`,
    revocation_endpoint: `${i}/oauth/revoke`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    scopes_supported: SCOPES,
    client_id_metadata_document_supported: true,
    service_documentation: `${i}/`,
  };
}

export function protectedResourceMetadata() {
  return {
    resource: resourceUrl(),
    authorization_servers: [issuer()],
    bearer_methods_supported: ["header"],
    scopes_supported: SCOPES,
    resource_name: "reedright brain",
    resource_documentation: `${issuer()}/`,
  };
}

export const sha256b64url = (s: string) => createHash("sha256").update(s).digest("base64url");

function isAllowedRedirect(u: string): boolean {
  try {
    const url = new URL(u);
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
  } catch {
    return false;
  }
}

function normalizeMetadata(raw: unknown) {
  const parsed = OAuthClientMetadataSchema.safeParse(raw);
  if (!parsed.success) throw new OAuthError("invalid_client_metadata", parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "));
  const m = parsed.data;
  if (!m.redirect_uris.length || !m.redirect_uris.every(isAllowedRedirect)) throw new OAuthError("invalid_redirect_uri", "redirect_uris must be https URLs (http is allowed for localhost only)");
  const method = m.token_endpoint_auth_method ?? "none";
  if (!["none", "client_secret_post"].includes(method)) throw new OAuthError("invalid_client_metadata", "token_endpoint_auth_method must be none or client_secret_post");
  const grants = m.grant_types?.length ? m.grant_types : ["authorization_code"];
  if (grants.some((g) => !["authorization_code", "refresh_token"].includes(g))) throw new OAuthError("invalid_client_metadata", "grant_types may only include authorization_code and refresh_token");
  if ((m.response_types ?? ["code"]).some((r) => r !== "code")) throw new OAuthError("invalid_client_metadata", "response_types may only include code");
  return { m, method, grants };
}

/** Dynamic client registration (RFC 7591). Open registration; secrets only for client_secret_post clients. */
export async function registerClient(raw: unknown) {
  const { m, method, grants } = normalizeMetadata(raw);
  const id = `rrc_${randomBytes(16).toString("base64url")}`;
  const secret = method === "client_secret_post" ? randomBytes(32).toString("base64url") : null;
  await prisma().oAuthClient.create({
    data: { id, source: "dcr", name: m.client_name ?? "unnamed client", redirectUris: JSON.stringify(m.redirect_uris), tokenEndpointAuthMethod: method, secretHash: secret ? hashToken(secret) : null, metadata: JSON.stringify(raw), createdAt: now() },
  });
  return {
    ...m,
    client_id: id,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
    token_endpoint_auth_method: method,
    grant_types: grants,
    response_types: ["code"],
  };
}

/** Client ID Metadata Document: the client_id is an https URL whose JSON body describes the client. */
async function fetchClientMetadataDocument(url: string) {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new OAuthError("invalid_client", "client_id is not a valid URL", 401);
  }
  if (u.protocol !== "https:" || u.username || u.password || u.hash) throw new OAuthError("invalid_client", "client_id metadata URL must be a plain https URL", 401);
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" }, redirect: "manual", signal: AbortSignal.timeout(5000) });
  } catch (e) {
    throw new OAuthError("invalid_client", `could not fetch client metadata document: ${(e as Error).message}`, 401);
  }
  if (!res.ok) throw new OAuthError("invalid_client", `client metadata document returned HTTP ${res.status}`, 401);
  const text = await res.text();
  if (text.length > 65536) throw new OAuthError("invalid_client", "client metadata document is too large", 401);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new OAuthError("invalid_client", "client metadata document is not JSON", 401);
  }
  if (!json || typeof json !== "object" || (json as { client_id?: unknown }).client_id !== url) {
    throw new OAuthError("invalid_client", "client_id inside the metadata document must equal its URL", 401);
  }
  const { m, method } = normalizeMetadata(json);
  return { name: m.client_name ?? u.hostname, redirectUris: m.redirect_uris, method, metadata: text };
}

export async function resolveClient(clientId: string): Promise<OAuthClient> {
  const existing = await prisma().oAuthClient.findUnique({ where: { id: clientId } });
  if (existing?.source === "dcr") return existing;
  if (existing?.fetchedAt && Date.now() - Date.parse(existing.fetchedAt) < CIMD_CACHE_MS) return existing;
  if (!clientId.startsWith("https://")) throw new OAuthError("invalid_client", "unknown client_id", 401);
  let doc: Awaited<ReturnType<typeof fetchClientMetadataDocument>>;
  try {
    doc = await fetchClientMetadataDocument(clientId);
  } catch (e) {
    if (existing) return existing; // stale cache beats an outage
    throw e;
  }
  const data = { name: doc.name, redirectUris: JSON.stringify(doc.redirectUris), tokenEndpointAuthMethod: doc.method, metadata: doc.metadata, fetchedAt: now() };
  return prisma().oAuthClient.upsert({ where: { id: clientId }, create: { id: clientId, source: "cimd", createdAt: now(), ...data }, update: data });
}

export const redirectUrisOf = (c: OAuthClient) => JSON.parse(c.redirectUris) as string[];

export interface AuthorizeRequest {
  client: OAuthClient;
  redirectUri: string;
  state: string | null;
  scope: string | null;
  resource: string | null;
  codeChallenge: string;
}

/** Thrown when the client and redirect_uri are trustworthy, so the error can be delivered to the client. */
export class RedirectableOAuthError extends OAuthError {
  constructor(
    code: string,
    message: string,
    public redirectUri: string,
    public state: string | null,
  ) {
    super(code, message);
  }
  location() {
    const u = new URL(this.redirectUri);
    u.searchParams.set("error", this.code);
    u.searchParams.set("error_description", this.message);
    if (this.state) u.searchParams.set("state", this.state);
    return u.toString();
  }
}

export async function validateAuthorizeRequest(sp: URLSearchParams): Promise<AuthorizeRequest> {
  const clientId = sp.get("client_id");
  if (!clientId) throw new OAuthError("invalid_request", "client_id is required");
  const client = await resolveClient(clientId);
  const uris = redirectUrisOf(client);
  const redirectUri = sp.get("redirect_uri") ?? (uris.length === 1 ? uris[0] : null);
  if (!redirectUri || !uris.includes(redirectUri)) throw new OAuthError("invalid_request", "redirect_uri is missing or not registered for this client");
  const state = sp.get("state");
  const fail = (code: string, msg: string) => new RedirectableOAuthError(code, msg, redirectUri, state);
  if (sp.get("response_type") !== "code") throw fail("unsupported_response_type", "response_type must be code");
  const codeChallenge = sp.get("code_challenge");
  if (!codeChallenge) throw fail("invalid_request", "code_challenge is required (PKCE)");
  if ((sp.get("code_challenge_method") ?? "plain") !== "S256") throw fail("invalid_request", "code_challenge_method must be S256");
  const resource = sp.get("resource");
  if (resource && !sameResource(resource)) throw fail("invalid_target", `resource must be ${resourceUrl()}`);
  const scope = sp.get("scope");
  if (scope && scope.split(/\s+/).some((s) => s && !SCOPES.includes(s))) throw fail("invalid_scope", `supported scopes: ${SCOPES.join(" ")}`);
  return { client, redirectUri, state, scope, resource, codeChallenge };
}

function sameResource(r: string) {
  return r.replace(/\/$/, "") === resourceUrl();
}

export async function issueCode(input: { client: OAuthClient; userId: string; orgId: string; redirectUri: string; codeChallenge: string; scope: string | null; resource: string | null }): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  await prisma().oAuthCode.create({
    data: {
      codeHash: hashToken(code), clientId: input.client.id, userId: input.userId, orgId: input.orgId, redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge, codeChallengeMethod: "S256", scope: input.scope, resource: input.resource,
      expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(), createdAt: now(),
    },
  });
  return code;
}

async function authenticateClient(form: URLSearchParams): Promise<OAuthClient> {
  const clientId = form.get("client_id");
  if (!clientId) throw new OAuthError("invalid_client", "client_id is required", 401);
  const client = await resolveClient(clientId);
  if (client.tokenEndpointAuthMethod === "client_secret_post") {
    const secret = form.get("client_secret") ?? "";
    const given = Buffer.from(hashToken(secret));
    const expected = Buffer.from(client.secretHash ?? "");
    if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) throw new OAuthError("invalid_client", "client authentication failed", 401);
  }
  return client;
}

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope?: string;
}

async function issueTokens(input: { userId: string; orgId: string; client: OAuthClient; scope: string | null }): Promise<TokenResponse> {
  const access = mintToken();
  const refresh = `rrr_${randomBytes(32).toString("base64url")}`;
  await prisma().apiToken.create({
    data: {
      userId: input.userId, orgId: input.orgId, name: `${input.client.name} (OAuth)`, tokenHash: access.hash, prefix: access.prefix, createdAt: now(),
      kind: "oauth", clientId: input.client.id, expiresAt: new Date(Date.now() + ACCESS_TTL_S * 1000).toISOString(),
      refreshTokenHash: hashToken(refresh), refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
    },
  });
  return { access_token: access.plaintext, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, ...(input.scope ? { scope: input.scope } : {}) };
}

export async function tokenEndpoint(form: URLSearchParams): Promise<TokenResponse> {
  const grant = form.get("grant_type");
  if (grant === "authorization_code") {
    const client = await authenticateClient(form);
    const code = form.get("code");
    const verifier = form.get("code_verifier");
    if (!code || !verifier) throw new OAuthError("invalid_request", "code and code_verifier are required");
    const row = await prisma().oAuthCode.findUnique({ where: { codeHash: hashToken(code) } });
    if (!row || row.clientId !== client.id) throw new OAuthError("invalid_grant", "unknown authorization code");
    if (row.usedAt) {
      // Replay: revoke everything minted for this client+user as a precaution (RFC 6749 §4.1.2).
      await prisma().apiToken.updateMany({ where: { clientId: client.id, userId: row.userId, revokedAt: null }, data: { revokedAt: now() } });
      throw new OAuthError("invalid_grant", "authorization code already used");
    }
    if (row.expiresAt < now()) throw new OAuthError("invalid_grant", "authorization code expired");
    const redirectUri = form.get("redirect_uri");
    if (redirectUri && redirectUri !== row.redirectUri) throw new OAuthError("invalid_grant", "redirect_uri does not match the authorization request");
    if (sha256b64url(verifier) !== row.codeChallenge) throw new OAuthError("invalid_grant", "PKCE verification failed");
    const resource = form.get("resource");
    if (resource && !sameResource(resource)) throw new OAuthError("invalid_target", `resource must be ${resourceUrl()}`);
    await prisma().oAuthCode.update({ where: { codeHash: row.codeHash }, data: { usedAt: now() } });
    const membership = await prisma().membership.findUnique({ where: { userId_orgId: { userId: row.userId, orgId: row.orgId } } });
    if (!membership) throw new OAuthError("invalid_grant", "the user is no longer a member of that organization");
    return issueTokens({ userId: row.userId, orgId: row.orgId, client, scope: row.scope });
  }
  if (grant === "refresh_token") {
    const client = await authenticateClient(form);
    const refresh = form.get("refresh_token");
    if (!refresh) throw new OAuthError("invalid_request", "refresh_token is required");
    const row = await prisma().apiToken.findUnique({ where: { refreshTokenHash: hashToken(refresh) } });
    if (!row || row.clientId !== client.id || row.revokedAt) throw new OAuthError("invalid_grant", "unknown or revoked refresh token");
    if (!row.refreshExpiresAt || row.refreshExpiresAt < now()) throw new OAuthError("invalid_grant", "refresh token expired");
    const membership = await prisma().membership.findUnique({ where: { userId_orgId: { userId: row.userId, orgId: row.orgId } } });
    if (!membership) throw new OAuthError("invalid_grant", "the user is no longer a member of that organization");
    await prisma().apiToken.update({ where: { id: row.id }, data: { revokedAt: now() } }); // rotation
    return issueTokens({ userId: row.userId, orgId: row.orgId, client, scope: form.get("scope") });
  }
  throw new OAuthError("unsupported_grant_type", "grant_type must be authorization_code or refresh_token");
}

/** RFC 7009. Accepts an access token or a refresh token; always 200 for unknown tokens. */
export async function revokeEndpoint(form: URLSearchParams): Promise<void> {
  const client = await authenticateClient(form);
  const token = form.get("token");
  if (!token) return;
  const h = hashToken(token);
  await prisma().apiToken.updateMany({ where: { clientId: client.id, revokedAt: null, OR: [{ tokenHash: h }, { refreshTokenHash: h }] }, data: { revokedAt: now() } });
}

export function corsHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-protocol-version",
    "Access-Control-Max-Age": "86400",
    ...extra,
  };
}

export const jsonNoStore = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders({ "Cache-Control": "no-store", Pragma: "no-cache" }) });

export async function formFromRequest(request: Request): Promise<URLSearchParams> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const j = (await request.json()) as Record<string, unknown>;
    return new URLSearchParams(Object.entries(j).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
  }
  return new URLSearchParams(await request.text());
}
