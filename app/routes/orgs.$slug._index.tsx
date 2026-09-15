import { Link } from "react-router";
import type { Route } from "./+types/orgs.$slug._index";
import { prisma } from "~/lib/db.server";
import { requireMember } from "~/lib/session.server";
import { Badge, Card, Empty, Page } from "~/components/ui";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { org, membership } = await requireMember(request, params.slug);
  const [members, open, merged, rejected] = await Promise.all([
    prisma().membership.count({ where: { orgId: org.id } }),
    prisma().writeRequest.count({ where: { orgId: org.id, status: "open" } }),
    prisma().writeRequest.count({ where: { orgId: org.id, status: "merged" } }),
    prisma().writeRequest.count({ where: { orgId: org.id, status: { in: ["rejected", "closed"] } } }),
  ]);
  const recent = await prisma().writeRequest.findMany({ where: { orgId: org.id }, orderBy: { createdAt: "desc" }, take: 10 });
  return {
    org: { slug: org.slug, name: org.name, repoOwner: org.repoOwner, repoName: org.repoName, connected: Boolean(org.githubInstallationId && org.repoName) },
    isAdmin: membership.role === "admin",
    counts: { members, open, merged, rejected },
    recent: recent.map((r) => ({ id: r.id, type: r.type, domain: r.domain, title: r.title, handle: r.handle, status: r.status, prUrl: r.prUrl, createdAt: r.createdAt.slice(0, 10) })),
  };
}

const tone = { open: "amber", merged: "green", rejected: "red", closed: "neutral" } as const;

export default function Overview({ loaderData }: Route.ComponentProps) {
  const { org, isAdmin, counts, recent } = loaderData;
  return (
    <Page title="Overview">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-medium text-stone-500">Brain repository</h2>
          {org.connected ? (
            <p>
              <a className="font-mono underline" href={`https://github.com/${org.repoOwner}/${org.repoName}`} target="_blank" rel="noreferrer">
                {org.repoOwner}/{org.repoName}
              </a>
            </p>
          ) : isAdmin ? (
            <p className="text-sm">
              Not connected yet. <Link className="underline" to={`/orgs/${org.slug}/connect`}>Install the GitHub App and pick a repo.</Link>
            </p>
          ) : (
            <Empty>Not connected yet. Ask an admin to connect the brain repository.</Empty>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-medium text-stone-500">Activity</h2>
          <dl className="grid grid-cols-4 gap-2 text-center">
            <div><dt className="text-xs text-stone-500">members</dt><dd className="text-xl font-semibold">{counts.members}</dd></div>
            <div><dt className="text-xs text-stone-500">awaiting</dt><dd className="text-xl font-semibold">{counts.open}</dd></div>
            <div><dt className="text-xs text-stone-500">merged</dt><dd className="text-xl font-semibold">{counts.merged}</dd></div>
            <div><dt className="text-xs text-stone-500">rejected</dt><dd className="text-xl font-semibold">{counts.rejected}</dd></div>
          </dl>
        </Card>
      </div>
      <Card className="mt-4">
        <h2 className="mb-3 text-sm font-medium text-stone-500">Recent write requests</h2>
        {recent.length === 0 ? (
          <Empty>Nothing yet. Mint a token on the Tokens page and point an agent at the MCP server.</Empty>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-stone-100 dark:border-stone-800">
                  <td className="py-2 pr-3 whitespace-nowrap text-stone-500">{r.createdAt}</td>
                  <td className="py-2 pr-3"><Badge>{r.type}/{r.domain}</Badge></td>
                  <td className="py-2 pr-3"><a className="underline" href={r.prUrl} target="_blank" rel="noreferrer">{r.title}</a></td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.handle}</td>
                  <td className="py-2 text-right"><Badge tone={tone[r.status as keyof typeof tone] ?? "neutral"}>{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </Page>
  );
}
