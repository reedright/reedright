// The approval record. Its URL is the approval_ref written into the file's frontmatter (RFC §4: not a git URL).
import { Link } from "react-router";
import type { Route } from "./+types/orgs.$slug.approvals.$id";
import { prisma } from "~/lib/db.server";
import { requireMember } from "~/lib/session.server";
import { Badge, Card, Page } from "~/components/ui";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { org } = await requireMember(request, params.slug);
  const a = await prisma().approval.findUnique({ where: { id: params.id }, include: { approver: true, writeRequest: { include: { user: true } } } });
  if (!a || a.orgId !== org.id) throw new Response("Approval record not found", { status: 404 });
  const wr = a.writeRequest;
  return {
    id: a.id,
    decision: a.decision,
    note: a.note,
    createdAt: a.createdAt,
    approver: { handle: a.approverHandle, name: a.approver.name, email: a.approver.email },
    request: { id: wr.id, type: wr.type, domain: wr.domain, title: wr.title, path: wr.path, handle: wr.handle, authorName: wr.user.name, run: wr.run, prUrl: wr.prUrl, status: wr.status, createdAt: wr.createdAt },
    orgSlug: org.slug,
  };
}

export default function ApprovalRecord({ loaderData: a }: Route.ComponentProps) {
  return (
    <Page title={`Approval ${a.id}`} aside={<Link className="text-sm underline" to={`/orgs/${a.orgSlug}/approvals`}>All approvals</Link>}>
      <Card>
        <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-[10rem_1fr]">
          <dt className="text-stone-500">decision</dt><dd><Badge tone={a.decision === "approve" ? "green" : "red"}>{a.decision}</Badge></dd>
          <dt className="text-stone-500">by</dt><dd><span className="font-mono">{a.approver.handle}</span> ({a.approver.name}, {a.approver.email})</dd>
          <dt className="text-stone-500">at</dt><dd className="font-mono">{a.createdAt}</dd>
          {a.note && <><dt className="text-stone-500">note</dt><dd>{a.note}</dd></>}
        </dl>
      </Card>
      <Card className="mt-4">
        <h2 className="mb-3 text-sm font-medium text-stone-500">What was decided</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-[10rem_1fr]">
          <dt className="text-stone-500">entry</dt><dd><Badge>{a.request.type}</Badge> <Badge>{a.request.domain}</Badge> {a.request.title}</dd>
          <dt className="text-stone-500">path</dt><dd className="font-mono">{a.request.path}</dd>
          <dt className="text-stone-500">author</dt><dd><span className="font-mono">{a.request.handle}</span> ({a.request.authorName})</dd>
          <dt className="text-stone-500">run</dt><dd className="font-mono">{a.request.run}</dd>
          <dt className="text-stone-500">proposed</dt><dd className="font-mono">{a.request.createdAt}</dd>
          <dt className="text-stone-500">review</dt><dd><Link className="underline" to={`/orgs/${a.orgSlug}/requests/${a.request.id}`}>what was proposed, file by file</Link></dd>
          <dt className="text-stone-500">pull request</dt><dd><a className="underline" href={a.request.prUrl} target="_blank" rel="noreferrer">{a.request.prUrl}</a> <Badge tone={a.request.status === "merged" ? "green" : "neutral"}>{a.request.status}</Badge></dd>
        </dl>
        <p className="mt-4 text-xs text-stone-500">This page is the approval event referenced by <code>approval_ref</code> in the file. Git history records the file change; this record is who decided and when.</p>
      </Card>
    </Page>
  );
}
