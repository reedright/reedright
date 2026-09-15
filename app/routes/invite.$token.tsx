import { Form, Link, data, redirect } from "react-router";
import type { Route } from "./+types/invite.$token";
import { prisma, now } from "~/lib/db.server";
import { getUser, requireUser } from "~/lib/session.server";
import { Alert, Button, Card } from "~/components/ui";

async function loadInvite(token: string) {
  const invite = await prisma().invite.findUnique({ where: { token }, include: { org: true } });
  if (!invite || invite.acceptedAt || invite.expiresAt < now()) return null;
  return invite;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const invite = await loadInvite(params.token);
  if (!invite) throw new Response("This invite link is invalid, expired, or already used.", { status: 404 });
  const user = await getUser(request);
  const already = user ? await prisma().membership.findUnique({ where: { userId_orgId: { userId: user.id, orgId: invite.orgId } } }) : null;
  return {
    org: { slug: invite.org.slug, name: invite.org.name },
    invite: { email: invite.email, handle: invite.handle, role: invite.role },
    user: user ? { email: user.email } : null,
    already: Boolean(already),
    path: `/invite/${params.token}`,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const invite = await loadInvite(params.token);
  if (!invite) return data({ error: "This invite link is invalid, expired, or already used." }, { status: 400 });
  const existing = await prisma().membership.findUnique({ where: { userId_orgId: { userId: user.id, orgId: invite.orgId } } });
  if (existing) return redirect(`/orgs/${invite.org.slug}`);
  if (await prisma().membership.findUnique({ where: { orgId_handle: { orgId: invite.orgId, handle: invite.handle } } })) {
    return data({ error: `The handle "${invite.handle}" was taken after this invite was created. Ask the admin for a new invite.` }, { status: 400 });
  }
  const ts = now();
  await prisma().$transaction([
    prisma().membership.create({ data: { userId: user.id, orgId: invite.orgId, handle: invite.handle, role: invite.role, createdAt: ts } }),
    prisma().invite.update({ where: { id: invite.id }, data: { acceptedAt: ts } }),
  ]);
  return redirect(`/orgs/${invite.org.slug}`);
}

export default function Invite({ loaderData, actionData }: Route.ComponentProps) {
  const { org, invite, user, already, path } = loaderData;
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Join {org.name}</h1>
      <Card>
        {actionData?.error && <div className="mb-4"><Alert>{actionData.error}</Alert></div>}
        <p className="text-sm">
          You were invited as <code className="font-mono">{invite.handle}</code> ({invite.role}). This handle becomes your identity in the brain: it is written as <code>author</code> on what you propose and <code>approved_by</code> on what you approve.
        </p>
        {already ? (
          <p className="mt-4 text-sm">You are already a member. <Link className="underline" to={`/orgs/${org.slug}`}>Open {org.name}</Link>.</p>
        ) : user ? (
          <Form method="post" className="mt-4">
            <p className="mb-3 text-sm text-stone-500">Signed in as {user.email}.</p>
            <Button type="submit">Accept invite</Button>
          </Form>
        ) : (
          <div className="mt-4 flex gap-3">
            <Link to={`/signup?next=${encodeURIComponent(path)}`}><Button type="button">Create an account</Button></Link>
            <Link to={`/login?next=${encodeURIComponent(path)}`}><Button type="button" variant="secondary">Log in</Button></Link>
          </div>
        )}
      </Card>
    </main>
  );
}
