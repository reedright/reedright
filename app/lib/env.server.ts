// Environment access. Loads .env for local dev (Railway injects vars directly). Never overrides existing vars.
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // ignore: malformed .env should not take the server down
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export const env = {
  get APP_URL() {
    return (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  },
  get SESSION_SECRET() {
    return required("SESSION_SECRET");
  },
  get GITHUB_APP_ID() {
    return required("GITHUB_APP_ID");
  },
  get GITHUB_APP_SLUG() {
    return required("GITHUB_APP_SLUG");
  },
  get GITHUB_APP_PRIVATE_KEY() {
    const b64 = process.env.GITHUB_APP_PRIVATE_KEY_B64;
    if (b64) return Buffer.from(b64, "base64").toString("utf8");
    return required("GITHUB_APP_PRIVATE_KEY");
  },
  get githubConfigured() {
    return Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_SLUG && (process.env.GITHUB_APP_PRIVATE_KEY_B64 || process.env.GITHUB_APP_PRIVATE_KEY));
  },
  get googleConfigured() {
    return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64);
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};
