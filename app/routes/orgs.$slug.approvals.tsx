import { Form, Link } from "react-router";
import type { Route } from "./+types/orgs.$slug.approvals";
import { prisma } from "~/lib/db.server";
import { handleApprovalAction } from "~/lib/brain/approval-action.server";
import { syncStatus } from "~/lib/brain/approve.server";
import { parseOwners, resolveApprovers } from "~/lib/brain/owners";
import { OWNERS_PATH } from "~/lib/brain/paths";
import { BrainRepo } from "~/lib/github/repo.server";
import { requireMember } from "~/lib/session.server";
import { Alert, Badge, Card, Empty, Input, Page, SubmitButton } from "~/components/ui";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { org, membership } = await requireMember(request, params.slug);
  const connected = Boolean(org.githubInstallationId && org.repoName);
  let openRows = await prisma().writeRequest.findMany({ where: { orgId: org.id, status: "open" }, orderBy: { createdAt: "asc" } });
  let eligibleFor = new Map<string, string[]>();
  let error: string | null = null;
  if (connected && openRows.length) {
    try {
      const repo = await BrainRepo.forOrg(org);
      openRows = (await Promise.all(openRows.map((wr) => syncStatus(repo, wr)))).filter((wr) => wr.status === "open");
      const ownersFile = await repo.readFile(OWNERS_PATH);
      if (ownersFile) {
        const owners = parseOwners(ownersFile.content);
        eligibleFor = new Map(openRows.map((wr) => [wr.id, resolveApprovers(owners, { domain: wr.domain, path: wr.path })]));
      }
    } catch (e) {
      error = (e as Error).message;
    }
  }
  const decided = await prisma().writeRequest.findMany({ where: { orgId: org.id, status: { not: "open" }, type: { not: "observation" } }, orderBy: { updatedAt: "desc" }, take: 20, include: { approvals: true } });
  return {
    connected,
    orgSlug: org.slug,
    handle: membership.handle,
    isAdmin: membership.role === "admin",
    error,
    open: openRows.map((wr) => {
      const eligible = eligibleFor.get(wr.id) ?? [];
      const lint = JSON.parse(wr.lintReport) as { warnings?: Array<{ rule: string; message: string }> };
      const count = wr.kind === "sync" && wr.paths ? (JSON.parse(wr.paths) as string[]).length : 1;
      return { id: wr.id, kind: wr.kind, count, type: wr.type, domain: wr.domain, title: wr.title, path: wr.path, handle: wr.handle, run: wr.run, prUrl: wr.prUrl, createdAt: wr.createdAt.slice(0, 16).replace("T", " "), eligible, canApprove: eligible.includes(membership.handle), warnings: lint.warnings ?? [] };
    }),
    decided: decided.map((wr) => ({ id: wr.id, type: wr.type, domain: wr.domain, title: wr.title, handle: wr.handle, status: wr.status, prUrl: wr.prUrl, updatedAt: wr.updatedAt.slice(0, 10), approvals: wr.approvals.map((a) => ({ id: a.id, decision: a.decision, by: a.approverHandle })) })),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  return handleApprovalAction(request, params.slug);
}

const tone = { merged: "green", rejected: "red", closed: "neutral" } as const;

export default function Approvals({ loaderData, actionData }: Route.ComponentProps) {
  const { connected, handle, error, open, decided } = loaderData;
  const msg = actionData as { ok?: string; error?: string; lint?: string[] } | undefined;
  return (
    <Page title="Approvals">
      {!connected && <div className="mb-4"><Alert kind="info">No brain repository is connected yet.</Alert></div>}
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {msg?.ok && <div className="mb-4"><Alert kind="success">{msg.ok}</Alert></div>}
      {msg?.error && (
        <div className="mb-4">
          <Alert>
            {msg.error}
            {msg.lint && msg.lint.length > 0 && <ul className="mt-1 list-disc pl-5">{msg.lint.map((l) => <li key={l}>{l}</li>)}</ul>}
          </Alert>
        </div>
      )}
      <p className="mb-4 text-sm text-stone-600 dark:text-stone-400">
        Rules, procedures, and refs wait here until an owner of their domain approves. You are <code className="font-mono">{handle}</code>. Approving writes your handle, the time, and a link to this record into the file, then merges.
      </p>
      {open.length === 0 ? (
        <Card><Empty>Nothing is waiting for approval.</Empty></Card>
      ) : (
        <ul className="space-y-4">
          {open.map((wr) => (
            <li key={wr.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2"><Badge tone="amber">{wr.type}</Badge><Badge>{wr.domain}</Badge>{wr.kind === "sync" && <Badge tone="blue">drive sync · {wr.count} file{wr.count === 1 ? "" : "s"}</Badge>}<Link className="font-medium underline" to={`/orgs/${loaderData.orgSlug}/requests/${wr.id}`}>{wr.title}</Link></div>
                    <p className="mt-1 text-xs text-stone-500">
                      by <span className="font-mono">{wr.handle}</span> · run <span className="font-mono">{wr.run}</span> · {wr.createdAt} · <Link className="underline" to={`/orgs/${loaderData.orgSlug}/requests/${wr.id}`}>review</Link> · <a className="underline" href={wr.prUrl} target="_blank" rel="noreferrer">GitHub</a>
                    </p>
                    <p className="mt-1 font-mono text-xs text-stone-500">{wr.kind === "sync" ? `refs/${wr.domain}/ (${wr.count} files, listed on the PR)` : wr.path}</p>
                    {wr.warnings.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-amber-700 dark:text-amber-400">{wr.warnings.map((w) => <li key={w.rule}>{w.rule}: {w.message}</li>)}</ul>}
                    <p className="mt-2 text-xs text-stone-500">Can approve: {wr.eligible.length ? wr.eligible.map((h) => <Badge key={h} tone={h === handle ? "green" : "neutral"}>{h}</Badge>) : "nobody listed in OWNERS.yaml"}</p>
                  </div>
                  <Form method="post" className="flex flex-col items-end gap-2">
                    <input type="hidden" name="requestId" value={wr.id} />
                    <Input name="note" placeholder="note (optional)" className="w-56" />
                    <div className="flex gap-2">
                      <SubmitButton name="intent" value="reject" variant="secondary" match={{ requestId: wr.id, intent: "reject" }} pendingText="Rejecting…">Reject</SubmitButton>
                      <SubmitButton name="intent" value="approve" match={{ requestId: wr.id, intent: "approve" }} pendingText="Approving and merging…" disabled={!wr.canApprove} title={wr.canApprove ? "" : "You are not an owner of this domain"}>Approve and merge</SubmitButton>
                    </div>
                  </Form>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Card className="mt-6">
        <h2 className="mb-3 text-sm font-medium text-stone-500">Decided</h2>
        {decided.length === 0 ? <Empty>None yet.</Empty> : (
          <table className="w-full text-sm">
            <tbody>
              {decided.map((wr) => (
                <tr key={wr.id} className="border-t border-stone-100 dark:border-stone-800">
                  <td className="py-2 pr-3 text-stone-500">{wr.updatedAt}</td>
                  <td className="py-2 pr-3"><Badge>{wr.type}/{wr.domain}</Badge></td>
                  <td className="py-2 pr-3"><Link className="underline" to={`/orgs/${loaderData.orgSlug}/requests/${wr.id}`}>{wr.title}</Link></td>
                  <td className="py-2 pr-3 font-mono text-xs">{wr.handle}</td>
                  <td className="py-2 pr-3 text-xs">{wr.approvals.map((a) => <Link key={a.id} className="underline" to={`/orgs/${loaderData.orgSlug}/approvals/${a.id}`}>{a.decision} by {a.by}</Link>)}</td>
                  <td className="py-2 text-right"><Badge tone={tone[wr.status as keyof typeof tone] ?? "neutral"}>{wr.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </Page>
  );
}
