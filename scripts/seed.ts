// Dev seed: an org with an admin and a member, one MCP token each. Prints the tokens.
// Usage: pnpm seed [org-slug] [admin-email] [member-email]
import { prisma, now } from "../app/lib/db.server";
import { hashPassword } from "../app/lib/password.server";
import { mintToken } from "../app/lib/tokens.server";

const [slug = "liveitup", adminEmail = "cam@example.com", memberEmail = "roadrunner@example.com"] = process.argv.slice(2);
const password = process.env.SEED_PASSWORD ?? "password123";

async function upsertUser(email: string, name: string) {
  const existing = await prisma().user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma().user.create({ data: { email, name, passwordHash: await hashPassword(password), createdAt: now() } });
}

async function main() {
  const admin = await upsertUser(adminEmail, "Cam");
  const member = await upsertUser(memberEmail, "RoadRunner");
  let org = await prisma().org.findUnique({ where: { slug } });
  if (!org) org = await prisma().org.create({ data: { slug, name: slug === "liveitup" ? "Live it Up" : slug, createdAt: now() } });
  for (const [u, handle, role] of [[admin, "cam", "admin"], [member, "growth-lead", "member"]] as const) {
    const m = await prisma().membership.findUnique({ where: { userId_orgId: { userId: u.id, orgId: org.id } } });
    if (!m) await prisma().membership.create({ data: { userId: u.id, orgId: org.id, handle, role, createdAt: now() } });
  }
  const out: Record<string, string> = {};
  for (const [u, label] of [[admin, "TOKEN_A (cam, admin)"], [member, "TOKEN_B (growth-lead, member)"]] as const) {
    const t = mintToken();
    await prisma().apiToken.create({ data: { userId: u.id, orgId: org.id, name: "seed", tokenHash: t.hash, prefix: t.prefix, createdAt: now() } });
    out[label] = t.plaintext;
  }
  console.log(`org: ${slug}  login: ${adminEmail} / ${password}  member: ${memberEmail} / ${password}`);
  for (const [k, v] of Object.entries(out)) console.log(`${k}: ${v}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
