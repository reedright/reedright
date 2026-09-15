// HMAC-signed opaque values (used for the GitHub install `state`). Not encryption; just tamper-proofing.
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env.server";

function mac(value: string) {
  return createHmac("sha256", env.SESSION_SECRET).update(value).digest("base64url");
}

export function sign(value: string): string {
  return `${Buffer.from(value).toString("base64url")}.${mac(value)}`;
}

export function verify(signed: string | null | undefined): string | null {
  if (!signed) return null;
  const dot = signed.lastIndexOf(".");
  if (dot < 0) return null;
  const value = Buffer.from(signed.slice(0, dot), "base64url").toString();
  const given = Buffer.from(signed.slice(dot + 1));
  const expected = Buffer.from(mac(value));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return value;
}
