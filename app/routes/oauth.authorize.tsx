// The consent page. The person signs in (if needed), picks the organization the token is for, and approves.
import { Form, data, redirect } from "react-router";
import type { Route } from "./+types/oauth.authorize";
import { prisma } from "~/lib/db.server";
import { OAuthError, RedirectableOAuthError, issueCode, validateAuthorizeRequest } from "~/lib/oauth.server";
import { requireUser } from "~/lib/session.server";
import { str } from "~/lib/validate";
import { Alert, Button, Card, Select } from "~/components/ui";
import { Shell } from "~/components/shell";

async function load(request: Request) {
  const sp = new URL(request.url).searchParams;
  try {
    return { req: await validateAuthorizeRequest(sp), error: null };
  } catch (e) {
    if (e instanceof RedirectableOAuthError) throw redirect(e.location());
    if (e instanceof OAuthError) return { req: null, error: `${e.code}: ${e.message}` };
    throw e;
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { req, error } = await load(request);
  if (!req) return { error, client: null, orgs: [], user: { email: user.email } };
  const memberships = await prisma().membership.findMany({ where: { userId: user.id }, include: { org: true }, orderBy: { createdAt: "asc" } });
  return {
    error: null,
    client: { id: req.client.id, name: req.client.name, source: req.client.source, redirectUri: req.redirectUri, scope: req.scope },
    orgs: memberships.map((m) => ({ id: m.org.id, slug: m.org.slug, name: m.org.name, handle: m.handle })),
    user: { email: user.email },
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const { req, error } = await load(request);
  if (!req) return data({ error }, { status: 400 });
  const form = await request.formData();
  if (str(form, "intent") === "deny") throw redirect(new RedirectableOAuthError("access_denied", "the user denied the request", req.redirectUri, req.state).location());
  const orgId = str(form, "orgId");
  const membership = await prisma().membership.findUnique({ where: { userId_orgId: { userId: user.id, orgId } } });
  if (!membership) return data({ error: "Pick an organization you belong to." }, { status: 400 });
  const code = await issueCode({ client: req.client, userId: user.id, orgId, redirectUri: req.redirectUri, codeChallenge: req.codeChallenge, scope: req.scope, resource: req.resource });
  const u = new URL(req.redirectUri);
  u.searchParams.set("code", code);
  if (req.state) u.searchParams.set("state", req.state);
  throw redirect(u.toString());
}

export default function Authorize({ loaderData, actionData }: Route.ComponentProps) {
  const { error, client, orgs, user } = loaderData;
  const err = actionData?.error ?? error;
  return (
    <Shell footer={false} user={user}>
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Authorize access</h1>
        <Card>
          {err && <div className="mb-4"><Alert>{err}</Alert></div>}
          {client && (
            <Form method="post" className="space-y-4">
              <p className="text-sm">
                <strong>{client.name}</strong> wants to read and write the brain as you ({user.email}). It will act with your handle and everything it proposes will carry your name as author.
              </p>
              <p className="text-xs text-stone-500 break-all">
                client: <code>{client.id}</code>{client.source === "cimd" ? " (published identity)" : " (registered)"} · returns to <code>{client.redirectUri}</code>
              </p>
              {orgs.length === 0 ? (
                <Alert kind="info">You are not in any organization yet. Create one or accept an invite, then try again.</Alert>
              ) : (
                <div>
                  <label htmlFor="orgId" className="block text-sm font-medium">Organization</label>
                  <Select id="orgId" name="orgId" defaultValue={orgs[0].id}>
                    {orgs.map((o) => <option key={o.id} value={o.id}>{o.name} (as {o.handle})</option>)}
                  </Select>
                  <p className="mt-1 text-xs text-stone-500">A token is for one organization. Authorize again to add another.</p>
                </div>
              )}
              <div className="flex gap-3">
                <Button type="submit" name="intent" value="approve" disabled={orgs.length === 0}>Approve</Button>
                <Button type="submit" name="intent" value="deny" variant="secondary">Deny</Button>
              </div>
            </Form>
          )}
        </Card>
        <p className="mt-4 text-xs text-stone-500">You can revoke this access any time from the Tokens page of that organization.</p>
      </main>
    </Shell>
  );
}
