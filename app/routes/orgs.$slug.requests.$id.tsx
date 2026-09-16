// Review one write request: what the PR changes, file by file, with the new version rendered and a diff when the file already existed.
import { Form, Link } from "react-router";
import type { Route } from "./+types/orgs.$slug.requests.$id";
import { prisma } from "~/lib/db.server";
import { handleApprovalAction, type ApprovalActionData } from "~/lib/brain/approval-action.server";
import { syncStatus } from "~/lib/brain/approve.server";
import { parsePatch, type Hunk } from "~/lib/brain/diff";
import { splitFrontmatter } from "~/lib/brain/frontmatter";
import { parseOwners, resolveApprovers } from "~/lib/brain/owners";
import { OWNERS_PATH } from "~/lib/brain/paths";
import { BrainRepo, type PRFile } from "~/lib/github/repo.server";
import { requireMember } from "~/lib/session.server";
import { DiffView, MarkdownView } from "~/components/markdown";
import { Alert, Badge, Card, Code, Empty, Input, Page, SubmitButton } from "~/components/ui";

const RENDER_LIMIT = 25;
const MAX_RENDER_CHARS = 200_000;

interface FileView {
  path: string;
  status: PRFile["status"];
  previousPath: string | null;
  additions: number;
  deletions: number;
  hunks: Hunk[] | null;
  note: string | null;
  frontmatter: Array<[string, string]> | null;
  body: string | null;
  raw: string | null;
}

async function toView(repo: BrainRepo, f: PRFile, ref: string): Promise<FileView> {
  const view: FileView = { path: f.path, status: f.status, previousPath: f.previousPath, additions: f.additions, deletions: f.deletions, hunks: null, note: null, frontmatter: null, body: null, raw: null };
  if (f.status !== "added" && f.status !== "removed") view.hunks = f.patch ? parsePatch(f.patch) : null;
  if (f.status === "removed") view.hunks = f.patch ? parsePatch(f.patch) : null;
  if (!f.patch && f.status !== "added") view.note = "GitHub returned no diff for this file (too large or binary).";
  if (f.path.endsWith(".md") && f.status !== "removed") {
    const file = await repo.readFile(f.path, ref).catch(() => null);
    if (!file) view.note = view.note ?? "The new version could not be loaded (the branch may be gone).";
    else if (file.content.length > MAX_RENDER_CHARS) view.note = "Too large to render here; open it on GitHub.";
    else {
      view.raw = file.content;
      const split = splitFrontmatter(file.content);
      if (split.data && typeof split.data === "object") view.frontmatter = Object.entries(split.data as Record<string, unknown>).map(([k, v]) => [k, v == null ? "null" : String(v)]);
      view.body = split.body;
    }
  }
  return view;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { org, membership } = await requireMember(request, params.slug);
  const wr = await prisma().writeRequest.findUnique({ where: { id: params.id }, include: { approvals: true, user: true } });
  if (!wr || wr.orgId !== org.id) throw new Response("Write request not found", { status: 404 });
  const connected = Boolean(org.githubInstallationId && org.repoName);
  let status = wr.status;
  let eligible: string[] = [];
  let files: FileView[] = [];
  let more = 0;
  let error: string | null = null;
  if (connected) {
    try {
      const repo = await BrainRepo.forOrg(org);
      status = (await syncStatus(repo, wr)).status;
      const pr = await repo.getPR(wr.prNumber);
      const ownersFile = await repo.readFile(OWNERS_PATH);
      if (ownersFile) eligible = resolveApprovers(parseOwners(ownersFile.content), { domain: wr.domain, path: wr.path });
      const prFiles = await repo.listPRFiles(wr.prNumber);
      const shown = prFiles.slice(0, RENDER_LIMIT);
      more = prFiles.length - shown.length;
      const ref = status === "merged" ? repo.defaultBranch : pr.headSha;
      files = await Promise.all(shown.map((f) => toView(repo, f, ref)));
    } catch (e) {
      error = (e as Error).message;
    }
  }
  const lint = JSON.parse(wr.lintReport) as { errors?: Array<{ rule: string; message: string }>; warnings?: Array<{ rule: string; message: string }> };
  const summary = wr.kind === "sync" && wr.summary ? (JSON.parse(wr.summary) as Record<string, number>) : null;
  return {
    orgSlug: org.slug,
    me: membership.handle,
    connected,
    error,
    request: { id: wr.id, kind: wr.kind, type: wr.type, domain: wr.domain, title: wr.title, path: wr.path, handle: wr.handle, authorName: wr.user.name, run: wr.run, prUrl: wr.prUrl, prNumber: wr.prNumber, status, createdAt: wr.createdAt.slice(0, 16).replace("T", " "), summary },
    eligible,
    canApprove: status === "open" && eligible.includes(membership.handle),
    canReject: status === "open" && (eligible.includes(membership.handle) || membership.role === "admin"),
    lint: { errors: lint.errors ?? [], warnings: lint.warnings ?? [] },
    approvals: wr.approvals.map((a) => ({ id: a.id, decision: a.decision, by: a.approverHandle, at: a.createdAt.slice(0, 16).replace("T", " "), note: a.note })),
    files,
    more,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  return handleApprovalAction(request, params.slug);
}

const statusTone = { open: "amber", merged: "green", rejected: "red", closed: "neutral" } as const;
const fileTone = { added: "green", removed: "red", modified: "amber", renamed: "blue", copied: "blue", changed: "amber", unchanged: "neutral" } as const;

export default function RequestReview({ loaderData, actionData }: Route.ComponentProps) {
  const { orgSlug, me, connected, error, request: r, eligible, canApprove, canReject, lint, approvals, files, more } = loaderData;
  const msg = actionData as ApprovalActionData | undefined;
  return (
    <Page title={<span><Badge tone="amber">{r.type}</Badge> <Badge>{r.domain}</Badge> {r.title}</span>} aside={<Link className="text-sm underline" to={`/orgs/${orgSlug}/approvals`}>All approvals</Link>}>
      {msg?.ok && <div className="mb-4"><Alert kind="success">{msg.ok}</Alert></div>}
      {msg?.error && (
        <div className="mb-4">
          <Alert>
            {msg.error}
            {msg.lint && msg.lint.length > 0 && <ul className="mt-1 list-disc pl-5">{msg.lint.map((l) => <li key={l}>{l}</li>)}</ul>}
          </Alert>
        </div>
      )}
      {!connected && <div className="mb-4"><Alert kind="info">No brain repository is connected, so only the record is shown.</Alert></div>}
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <dl className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-[8rem_1fr]">
            <dt className="text-stone-500">status</dt><dd><Badge tone={statusTone[r.status as keyof typeof statusTone] ?? "neutral"}>{r.status}</Badge></dd>
            <dt className="text-stone-500">author</dt><dd><span className="font-mono">{r.handle}</span> ({r.authorName})</dd>
            <dt className="text-stone-500">run</dt><dd className="font-mono text-xs">{r.run}</dd>
            <dt className="text-stone-500">proposed</dt><dd>{r.createdAt}</dd>
            <dt className="text-stone-500">pull request</dt><dd><a className="underline" href={r.prUrl} target="_blank" rel="noreferrer">#{r.prNumber} on GitHub</a></dd>
            {r.kind === "sync" && r.summary && (
              <><dt className="text-stone-500">drive sync</dt><dd>{Object.entries(r.summary).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(", ")}</dd></>
            )}
            <dt className="text-stone-500">can approve</dt><dd>{eligible.length ? eligible.map((h) => <Badge key={h} tone={h === me ? "green" : "neutral"}>{h}</Badge>) : "nobody listed in OWNERS.yaml"}</dd>
          </dl>
          {r.status === "open" && connected && (
            <Form method="post" className="flex flex-col items-end gap-2">
              <input type="hidden" name="requestId" value={r.id} />
              <Input name="note" placeholder="note (optional)" className="w-56" />
              <div className="flex gap-2">
                <SubmitButton name="intent" value="reject" variant="secondary" match={{ intent: "reject" }} pendingText="Rejecting…" disabled={!canReject}>Reject</SubmitButton>
                <SubmitButton name="intent" value="approve" match={{ intent: "approve" }} pendingText="Approving and merging…" disabled={!canApprove} title={canApprove ? "" : "You are not an owner of this domain"}>Approve and merge</SubmitButton>
              </div>
            </Form>
          )}
        </div>
        {(lint.warnings.length > 0 || lint.errors.length > 0) && (
          <div className="mt-3 border-t border-stone-100 pt-3 text-xs dark:border-stone-800">
            {lint.errors.map((w) => <div key={w.rule} className="text-red-700 dark:text-red-400">lint error · {w.rule}: {w.message}</div>)}
            {lint.warnings.map((w) => <div key={w.rule} className="text-amber-700 dark:text-amber-400">lint warning · {w.rule}: {w.message}</div>)}
          </div>
        )}
        {approvals.length > 0 && (
          <div className="mt-3 border-t border-stone-100 pt-3 text-xs dark:border-stone-800">
            {approvals.map((a) => (
              <div key={a.id}>
                <Badge tone={a.decision === "approve" ? "green" : "red"}>{a.decision}</Badge> by <span className="font-mono">{a.by}</span> at {a.at}{a.note ? ` · ${a.note}` : ""} · <Link className="underline" to={`/orgs/${orgSlug}/approvals/${a.id}`}>record</Link>
              </div>
            ))}
          </div>
        )}
      </Card>

      {connected && !error && files.length === 0 && <Card className="mt-4"><Empty>The pull request has no files.</Empty></Card>}
      {files.map((f) => (
        <Card key={f.path} className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={fileTone[f.status] ?? "neutral"}>{f.status === "added" ? "new" : f.status}</Badge>
            <span className="font-mono text-xs break-all">{f.path}</span>
            {f.previousPath && <span className="text-xs text-stone-500">from <span className="font-mono">{f.previousPath}</span></span>}
            <span className="ml-auto text-xs text-stone-500"><span className="text-green-700 dark:text-green-400">+{f.additions}</span> <span className="text-red-700 dark:text-red-400">−{f.deletions}</span></span>
          </div>
          {f.note && <p className="mb-3 text-xs text-stone-500">{f.note}</p>}
          {f.hunks && f.hunks.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-xs font-medium text-stone-500">{f.status === "removed" ? "Removed" : "Changes against the current version"}</h3>
              <DiffView hunks={f.hunks} />
            </div>
          )}
          {f.body !== null && (
            <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
              {f.frontmatter && (
                <dl className="self-start rounded-md border border-stone-200 p-3 text-xs dark:border-stone-800">
                  {f.frontmatter.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2 py-0.5"><dt className="text-stone-500">{k}</dt><dd className="truncate text-right font-mono" title={v}>{v}</dd></div>
                  ))}
                </dl>
              )}
              <MarkdownView source={f.body} />
            </div>
          )}
          {f.raw !== null && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-stone-500">Raw file</summary>
              <div className="mt-2"><Code>{f.raw}</Code></div>
            </details>
          )}
        </Card>
      ))}
      {more > 0 && <p className="mt-4 text-sm text-stone-500">{more} more file{more === 1 ? "" : "s"} not shown here. <a className="underline" href={`${r.prUrl}/files`} target="_blank" rel="noreferrer">See them on GitHub.</a></p>}
    </Page>
  );
}
