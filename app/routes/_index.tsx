import { Link } from "react-router";
import type { Route } from "./+types/_index";
import { getUser } from "~/lib/session.server";
import { prisma } from "~/lib/db.server";
import { env } from "~/lib/env.server";
import { Landing } from "~/components/landing";
import { Shell } from "~/components/shell";
import { Badge, Button, Card, Empty, Page } from "~/components/ui";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  if (!user) return { user: null, orgs: [], appUrl: env.APP_URL };
  const memberships = await prisma().membership.findMany({
    where: { userId: user.id },
    include: { org: true },
    orderBy: { createdAt: "asc" },
  });
  return {
    appUrl: env.APP_URL,
    user: { email: user.email, name: user.name },
    orgs: memberships.map((m) => ({ slug: m.org.slug, name: m.org.name, handle: m.handle, role: m.role })),
  };
}

const description = "One reviewed source of what your company knows. Claude, ChatGPT, and your own agents read it before they answer. Anyone can add. The right person approves. Plain files you own.";

export function meta({ data }: Route.MetaArgs) {
  const title = "reedright · shared context for AI-forward teams";
  const image = `${data?.appUrl ?? ""}/og.png`;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: image },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { user, orgs } = loaderData;
  if (!user) return <Landing />;
  return (
    <Shell user={user}>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Page title="Your organizations" aside={<Link to="/orgs/new"><Button type="button" variant="secondary">New organization</Button></Link>}>
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
                      <span className="font-semibold">{o.name}</span>
                      <span className="flex gap-2"><Badge>{o.handle}</Badge><Badge tone={o.role === "admin" ? "ink" : "neutral"}>{o.role}</Badge></span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Page>
      </main>
    </Shell>
  );
}
