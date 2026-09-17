import { Form, Link, data } from "react-router";
import type { Route } from "./+types/orgs.$slug._index";
import { prisma } from "~/lib/db.server";
import { publishSite, rebuildSite, unpublishSite } from "~/lib/brain/site.server";
import { requireAdmin, requireMember } from "~/lib/session.server";
import { str } from "~/lib/validate";
import { Alert, Badge, Button, Card, Empty, Page, SubmitButton } from "~/components/ui";

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
    site: { url: org.siteUrl, publishedAt: org.sitePublishedAt?.slice(0, 10) ?? null, actionsUrl: `https://github.com/${org.repoOwner}/${org.repoName}/actions/workflows/reedright-site.yml` },
    isAdmin: membership.role === "admin",
    counts: { members, open, merged, rejected },
    recent: recent.map((r) => ({ id: r.id, type: r.type, domain: r.domain, title: r.title, handle: r.handle, status: r.status, prUrl: r.prUrl, flagged: Boolean(r.flags), createdAt: r.createdAt.slice(0, 10) })),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { org } = await requireAdmin(request, params.slug);
  const form = await request.formData();
  const intent = str(form, "intent");
  try {
    if (intent === "publish-site") {
      const r = await publishSite(org);
      const head = r.committed ? `Publishing. GitHub Actions is building the site now; it appears at ${r.siteUrl} in a few minutes.` : `Already publishing at ${r.siteUrl}.`;
      return data(r.warnings.length ? { warning: `${head} ${r.warnings.join(" ")}` } : { ok: head });
    }
    if (intent === "rebuild-site") {
      await rebuildSite(org);
      return data({ ok: "Rebuild started. The site updates when the workflow finishes." });
    }
    if (intent === "unpublish-site") {
      const r = await unpublishSite(org);
      return data({ ok: `${r.removed.length ? `Removed ${r.removed.join(" and ")}.` : "Nothing to remove."} The last build stays online until Pages is turned off in the repository settings.` });
    }
  } catch (e) {
    return data({ error: (e as Error).message }, { status: 500 });
  }
  return data({ error: "Unknown action." }, { status: 400 });
}

const tone = { open: "amber", merged: "green", rejected: "red", closed: "neutral" } as const;

export default function Overview({ loaderData, actionData }: Route.ComponentProps) {
  const { org, site, isAdmin, counts, recent } = loaderData;
  const msg = actionData as { ok?: string; warning?: string; error?: string } | undefined;
  return (
    <Page title="Overview">
      {msg?.ok && <div className="mb-4"><Alert kind="success">{msg.ok}</Alert></div>}
      {msg?.warning && <div className="mb-4"><Alert kind="info">{msg.warning}</Alert></div>}
      {msg?.error && <div className="mb-4"><Alert>{msg.error}</Alert></div>}
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

      {org.connected && (
        <Card className="mt-4">
          <h2 className="mb-2 text-sm font-medium text-stone-500">Site</h2>
          {site.url ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-sm">
                Published with Quartz at <a className="font-mono underline" href={site.url} target="_blank" rel="noreferrer">{site.url}</a>
                {site.publishedAt && <span className="text-stone-500"> since {site.publishedAt}</span>}. Rebuilds on every merge.{" "}
                <a className="underline" href={site.actionsUrl} target="_blank" rel="noreferrer">Builds</a>
              </p>
              {isAdmin && (
                <span className="ml-auto flex gap-2">
                  <Form method="post"><input type="hidden" name="intent" value="rebuild-site" /><SubmitButton variant="secondary" match={{ intent: "rebuild-site" }} pendingText="Starting…">Rebuild now</SubmitButton></Form>
                  <Form method="post"><input type="hidden" name="intent" value="unpublish-site" /><SubmitButton variant="danger" match={{ intent: "unpublish-site" }} pendingText="Removing…">Stop publishing</SubmitButton></Form>
                </span>
              )}
            </div>
          ) : isAdmin ? (
            <div className="flex flex-wrap items-center gap-4">
              <p className="grow text-sm text-stone-600 dark:text-stone-400">
                Publish a browsable site of the brain: a GitHub Actions workflow in the repository builds it with <a className="underline" href="https://quartz.jzhao.xyz" target="_blank" rel="noreferrer">Quartz</a> and deploys to GitHub Pages on every merge. Public repositories publish for free; private ones need a paid GitHub plan.
              </p>
              <Form method="post"><input type="hidden" name="intent" value="publish-site" /><SubmitButton match={{ intent: "publish-site" }} pendingText="Setting up Pages and committing the workflow…">Publish with Quartz</SubmitButton></Form>
            </div>
          ) : (
            <Empty>No site yet. An admin can publish one from this page.</Empty>
          )}
        </Card>
      )}

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
                  <td className="py-2 pr-3"><Badge>{r.type}/{r.domain}</Badge>{r.flagged && <> <Badge tone="red">flagged</Badge></>}</td>
                  <td className="py-2 pr-3"><Link className="underline" to={`/orgs/${org.slug}/requests/${r.id}`}>{r.title}</Link></td>
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
