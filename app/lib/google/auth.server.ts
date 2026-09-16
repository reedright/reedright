// Google service account auth: a signed JWT exchanged for a short-lived access token. No SDK needed.
import { createSign } from "node:crypto";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
let cached: { token: string; expiresAt: number } | null = null;

export function serviceAccount(): ServiceAccount | null {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (!b64) return null;
  const sa = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as Partial<ServiceAccount>;
  if (!sa.client_email || !sa.private_key) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_B64 is not a service account key");
  return { client_email: sa.client_email, private_key: sa.private_key, token_uri: sa.token_uri ?? "https://oauth2.googleapis.com/token" };
}

export function serviceAccountEmail(): string | null {
  return serviceAccount()?.client_email ?? null;
}

export async function driveAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const sa = serviceAccount();
  if (!sa) throw new Error("Google Drive is not configured on this server (GOOGLE_SERVICE_ACCOUNT_JSON_B64).");
  const b64 = (s: string) => Buffer.from(s).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const unsigned = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: sa.token_uri, iat, exp: iat + 3600 }))}`;
  const jwt = `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url")}`;
  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!json.access_token) throw new Error(`Google token exchange failed: ${json.error ?? res.status} ${json.error_description ?? ""}`);
  cached = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}
