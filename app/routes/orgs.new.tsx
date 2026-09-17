import { Form, data, redirect } from "react-router";
import type { Route } from "./+types/orgs.new";
import { prisma, now } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { HANDLE_RE, SLUG_RE, slugify, str } from "~/lib/validate";
import { Alert, Button, Card, Input, Label } from "~/components/ui";
import { Shell } from "~/components/shell";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user: { email: user.email }, suggestedHandle: slugify(user.name.split(/\s+/)[0] ?? "") || "admin" };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const name = str(form, "name");
  const slug = str(form, "slug") || slugify(name);
  const handle = str(form, "handle");
  if (!name) return data({ error: "Enter an organization name." }, { status: 400 });
  if (!SLUG_RE.test(slug)) return data({ error: "Slug must be 2 to 39 lowercase letters, digits, or hyphens." }, { status: 400 });
  if (!HANDLE_RE.test(handle)) return data({ error: "Handle must be lowercase letters, digits, or hyphens." }, { status: 400 });
  if (await prisma().org.findUnique({ where: { slug } })) return data({ error: "That slug is taken." }, { status: 400 });
  const ts = now();
  await prisma().org.create({
    data: { name, slug, createdAt: ts, memberships: { create: { userId: user.id, handle, role: "admin", createdAt: ts } } },
  });
  return redirect(`/orgs/${slug}`);
}

export default function NewOrg({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <Shell footer={false} user={loaderData.user}>
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">New organization</h1>
        <Card>
          <Form method="post" className="space-y-4">
            {actionData?.error && <Alert>{actionData.error}</Alert>}
            <div><Label htmlFor="name">Name</Label><Input id="name" name="name" required placeholder="Acme Corp" /></div>
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" placeholder="acmecorp" pattern="[a-z0-9][a-z0-9-]{1,38}" />
              <p className="mt-1 text-xs text-stone-500">Used in URLs. Leave blank to derive from the name.</p>
            </div>
            <div>
              <Label htmlFor="handle">Your handle in this org</Label>
              <Input id="handle" name="handle" required defaultValue={loaderData.suggestedHandle} pattern="[a-z0-9][a-z0-9-]{0,38}" />
              <p className="mt-1 text-xs text-stone-500">
                This is your identity in the brain's <code>OWNERS.yaml</code>. It is written as <code>author</code> and <code>approved_by</code> in files. Not a git username.
              </p>
            </div>
            <Button type="submit">Create organization</Button>
          </Form>
        </Card>
      </main>
    </Shell>
  );
}
