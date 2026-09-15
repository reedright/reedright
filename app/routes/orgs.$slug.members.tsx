import { randomBytes } from "node:crypto";
import { Form, data } from "react-router";
import type { Route } from "./+types/orgs.$slug.members";
import { prisma, now } from "~/lib/db.server";
import { env } from "~/lib/env.server";
import { requireAdmin, requireMember } from "~/lib/session.server";
import { HANDLE_RE, str } from "~/lib/validate";
import { Alert, Badge, Button, Card, Code, Empty, Input, Label, Page, Select } from "~/components/ui";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { org, membership } = await requireMember(request, params.slug);
  const isAdmin = membership.role === "admin";
  const members = await prisma().membership.findMany({ where: { orgId: org.id }, include: { user: true }, orderBy: { createdAt: "asc" } });
  const invites = isAdmin
    ? await prisma().invite.findMany({ where: { orgId: org.id, acceptedAt: null, expiresAt: { gt: now() } }, orderBy: { createdAt: "desc" } })
    : [];
  return {
    isAdmin,
    me: membership.userId,
    members: members.map((m) => ({ userId: m.userId, handle: m.handle, role: m.role, email: m.user.email, name: m.user.name })),
    invites: invites.map((i) => ({ id: i.id, email: i.email, handle: i.handle, role: i.role, url: `${env.APP_URL}/invite/${i.token}`, expiresAt: i.expiresAt.slice(0, 10) })),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { org, user } = await requireAdmin(request, params.slug);
  const form = await request.formData();
  const intent = str(form, "intent");
  if (intent === "invite") {
    const email = str(form, "email").toLowerCase();
    const handle = str(form, "handle");
    const role = str(form, "role") === "admin" ? "admin" : "member";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return data({ error: "Enter a valid email." }, { status: 400 });
    if (!HANDLE_RE.test(handle)) return data({ error: "Handle must be lowercase letters, digits, or hyphens." }, { status: 400 });
    if (await prisma().membership.findUnique({ where: { orgId_handle: { orgId: org.id, handle } } })) return data({ error: `Handle "${handle}" is already taken in this org.` }, { status: 400 });
    const ts = new Date();
    await prisma().invite.create({
      data: { orgId: org.id, email, handle, role, token: randomBytes(24).toString("base64url"), createdAt: ts.toISOString(), expiresAt: new Date(ts.getTime() + 7 * 86400e3).toISOString() },
    });
    return data({ ok: `Invite created for ${email}. Copy the link below and send it to them.` });
  }
  if (intent === "revoke-invite") {
    await prisma().invite.deleteMany({ where: { id: str(form, "id"), orgId: org.id } });
    return data({ ok: "Invite revoked." });
  }
  if (intent === "remove-member") {
    const userId = str(form, "userId");
    if (userId === user.id) return data({ error: "You cannot remove yourself." }, { status: 400 });
    await prisma().$transaction([
      prisma().apiToken.updateMany({ where: { orgId: org.id, userId, revokedAt: null }, data: { revokedAt: now() } }),
      prisma().membership.deleteMany({ where: { orgId: org.id, userId } }),
    ]);
    return data({ ok: "Member removed and their tokens revoked." });
  }
  return data({ error: "Unknown action." }, { status: 400 });
}

export default function Members({ loaderData, actionData }: Route.ComponentProps) {
  const { isAdmin, me, members, invites } = loaderData;
  return (
    <Page title="Members">
      {actionData && "error" in actionData && actionData.error && <div className="mb-4"><Alert>{actionData.error}</Alert></div>}
      {actionData && "ok" in actionData && actionData.ok && <div className="mb-4"><Alert kind="success">{actionData.ok}</Alert></div>}
      <Card>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-stone-500"><tr><th className="pb-2">Handle</th><th className="pb-2">Name</th><th className="pb-2">Email</th><th className="pb-2">Role</th><th /></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId} className="border-t border-stone-100 dark:border-stone-800">
                <td className="py-2 font-mono">{m.handle}</td>
                <td className="py-2">{m.name}</td>
                <td className="py-2 text-stone-500">{m.email}</td>
                <td className="py-2"><Badge tone={m.role === "admin" ? "blue" : "neutral"}>{m.role}</Badge></td>
                <td className="py-2 text-right">
                  {isAdmin && m.userId !== me && (
                    <Form method="post"><input type="hidden" name="intent" value="remove-member" /><input type="hidden" name="userId" value={m.userId} /><Button variant="danger" type="submit">Remove</Button></Form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-stone-500">
          Approval rights are not a reedright role. They come from <code>OWNERS.yaml</code> in the brain repo: a handle listed as an owner of a domain can approve that domain's rules, procedures, and refs.
        </p>
      </Card>
      {isAdmin && (
        <>
          <Card className="mt-4">
            <h2 className="mb-3 font-medium">Invite a teammate</h2>
            <Form method="post" className="grid gap-3 md:grid-cols-4">
              <input type="hidden" name="intent" value="invite" />
              <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
              <div><Label htmlFor="handle">Handle</Label><Input id="handle" name="handle" required placeholder="growth-lead" pattern="[a-z0-9][a-z0-9-]{0,38}" /></div>
              <div><Label htmlFor="role">Role</Label><Select id="role" name="role" defaultValue="member"><option value="member">member</option><option value="admin">admin</option></Select></div>
              <div className="flex items-end"><Button type="submit">Create invite link</Button></div>
            </Form>
            <p className="mt-2 text-xs text-stone-500">No email is sent. You get a link to share. Links expire in 7 days.</p>
          </Card>
          <Card className="mt-4">
            <h2 className="mb-3 font-medium">Pending invites</h2>
            {invites.length === 0 ? <Empty>None.</Empty> : (
              <ul className="space-y-3">
                {invites.map((i) => (
                  <li key={i.id} className="text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span>{i.email} as <Badge>{i.handle}</Badge> <Badge tone={i.role === "admin" ? "blue" : "neutral"}>{i.role}</Badge> <span className="text-stone-500">expires {i.expiresAt}</span></span>
                      <Form method="post"><input type="hidden" name="intent" value="revoke-invite" /><input type="hidden" name="id" value={i.id} /><Button variant="secondary" type="submit">Revoke</Button></Form>
                    </div>
                    <Code>{i.url}</Code>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </Page>
  );
}
