// Bearer tokens for the MCP endpoint. Plaintext is shown once; only the sha256 is stored.
import { createHash, randomBytes } from "node:crypto";
import { prisma, now } from "./db.server";

export function hashToken(plaintext: string) {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function mintToken() {
  const plaintext = `rr_${randomBytes(24).toString("base64url")}`;
  return { plaintext, hash: hashToken(plaintext), prefix: plaintext.slice(0, 8) };
}

export type TokenContext = NonNullable<Awaited<ReturnType<typeof resolveToken>>>;

/** Bearer plaintext -> user, org, membership. Null when unknown or revoked. */
export async function resolveToken(plaintext: string) {
  const token = await prisma().apiToken.findUnique({
    where: { tokenHash: hashToken(plaintext) },
    include: { user: true, org: true },
  });
  if (!token || token.revokedAt) return null;
  if (token.expiresAt && token.expiresAt < now()) return null;
  const membership = await prisma().membership.findUnique({
    where: { userId_orgId: { userId: token.userId, orgId: token.orgId } },
  });
  if (!membership) return null;
  void prisma().apiToken.update({ where: { id: token.id }, data: { lastUsedAt: now() } }).catch(() => {});
  return { token, user: token.user, org: token.org, membership };
}

export function bearerFromRequest(request: Request): string | null {
  const h = request.headers.get("Authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}
