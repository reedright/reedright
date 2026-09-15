import { Form, Link } from "react-router";
import type { Route } from "./+types/_index";
import { getUser } from "~/lib/session.server";
import { prisma } from "~/lib/db.server";
import { Badge, Button, Card, Empty } from "~/components/ui";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  if (!user) return { user: null, orgs: [] };
  const memberships = await prisma().membership.findMany({
    where: { userId: user.id },
    include: { org: true },
    orderBy: { createdAt: "asc" },
  });
  return {
    user: { email: user.email, name: user.name },
    orgs: memberships.map((m) => ({ slug: m.org.slug, name: m.org.name, handle: m.handle, role: m.role })),
  };
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { user, orgs } = loaderData;
  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">reedright</h1>
        <p className="mt-3 text-lg text-stone-600 dark:text-stone-400">
          The identity layer for a shared-context brain that lives in git.
        </p>
        <ul className="mt-6 list-disc space-y-1 pl-5 text-sm text-stone-600 dark:text-stone-400">
          <li>Agents read and write the brain through one MCP server, with a per-person token.</li>
          <li>Every write is a pull request. Observations merge on lint. Rules wait for a domain owner.</li>
          <li>Approvers need no git account. The record of who approved lives in the file.</li>
        </ul>
        <div className="mt-8 flex gap-3">
          <Link to="/signup"><Button type="button">Create an account</Button></Link>
          <Link to="/login"><Button type="button" variant="secondary">Log in</Button></Link>
        </div>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Your organizations</h1>
        <div className="flex items-center gap-3 text-sm text-stone-500">
          <span>{user.email}</span>
          <Form method="post" action="/logout"><button className="underline">Log out</button></Form>
        </div>
      </div>
      {orgs.length === 0 ? (
        <Card>
          <Empty>You are not in any organization yet. Create one, or accept an invite link from a teammate.</Empty>
        </Card>
      ) : (
        <ul className="space-y-2">
          {orgs.map((o) => (
            <li key={o.slug}>
              <Link to={`/orgs/${o.slug}`} className="block rounded-lg border border-stone-200 bg-white p-4 hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{o.name}</span>
                  <span className="flex gap-2"><Badge>{o.handle}</Badge><Badge tone={o.role === "admin" ? "blue" : "neutral"}>{o.role}</Badge></span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6">
        <Link to="/orgs/new"><Button type="button" variant="secondary">New organization</Button></Link>
      </div>
    </main>
  );
}
