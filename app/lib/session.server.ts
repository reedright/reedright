import { createCookieSessionStorage, redirect } from "react-router";
import { env } from "./env.server";
import { prisma } from "./db.server";

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "rr_session",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: env.isProduction,
    secrets: [env.SESSION_SECRET],
    maxAge: 60 * 60 * 24 * 30,
  },
});

async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function getUser(request: Request) {
  const session = await getSession(request);
  const userId = session.get("userId") as string | undefined;
  if (!userId) return null;
  return prisma().user.findUnique({ where: { id: userId } });
}

export async function requireUser(request: Request) {
  const user = await getUser(request);
  if (!user) {
    const next = new URL(request.url).pathname;
    throw redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return user;
}

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, { headers: { "Set-Cookie": await sessionStorage.commitSession(session) } });
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return redirect("/", { headers: { "Set-Cookie": await sessionStorage.destroySession(session) } });
}

/** User must be a member of the org. Returns user, org, membership. */
export async function requireMember(request: Request, slug: string) {
  const user = await requireUser(request);
  const org = await prisma().org.findUnique({ where: { slug } });
  if (!org) throw new Response("Organization not found", { status: 404 });
  const membership = await prisma().membership.findUnique({
    where: { userId_orgId: { userId: user.id, orgId: org.id } },
  });
  if (!membership) throw new Response("You are not a member of this organization", { status: 403 });
  return { user, org, membership };
}

/** Membership role admin. Note: approval rights come from OWNERS.yaml, not from this role. */
export async function requireAdmin(request: Request, slug: string) {
  const ctx = await requireMember(request, slug);
  if (ctx.membership.role !== "admin") throw new Response("Admins only", { status: 403 });
  return ctx;
}

/** Safe redirect target: same-origin path only. */
export function safeNext(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
