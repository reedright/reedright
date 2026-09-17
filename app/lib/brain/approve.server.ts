// Approve / reject a write request. Approval is recorded in the file's frontmatter, then the bot merges (RFC §6).
import { prisma, now } from "../db.server";
import { env } from "../env.server";
import { BrainRepo } from "../github/repo.server";
import type { Membership, Org, User, WriteRequest } from "../../../generated/prisma/client";
import { serializeEntry, splitFrontmatter } from "./frontmatter";
import { lint, type LintReport } from "./lint";
import { regenerateManifest } from "./manifest.server";
import { parseOwners, resolveApprovers } from "./owners";
import { OWNERS_PATH } from "./paths";
import { FrontmatterSchema, NEEDS_APPROVAL, TYPE_DIR, type EntryType } from "./schema";

export class ApproveError extends Error {
  constructor(
    message: string,
    public report: LintReport | null = null,
  ) {
    super(message);
  }
}

/** Reconcile a write request with the live PR (someone may have merged or closed it in GitHub). */
export async function syncStatus(repo: BrainRepo, wr: WriteRequest): Promise<WriteRequest> {
  if (wr.status !== "open") return wr;
  const pr = await repo.getPR(wr.prNumber);
  const status = pr.merged ? "merged" : pr.state === "closed" ? "closed" : "open";
  if (status === wr.status) return wr;
  return prisma().writeRequest.update({ where: { id: wr.id }, data: { status, updatedAt: now() } });
}

async function loadOpen(org: Org, requestId: string) {
  const wr = await prisma().writeRequest.findUnique({ where: { id: requestId } });
  if (!wr || wr.orgId !== org.id) throw new ApproveError("Write request not found.");
  const repo = await BrainRepo.forOrg(org);
  const synced = await syncStatus(repo, wr);
  if (synced.status !== "open") throw new ApproveError(`This request is already ${synced.status}.`);
  const ownersFile = await repo.readFile(OWNERS_PATH);
  if (!ownersFile) throw new ApproveError("OWNERS.yaml is missing from the brain repository.");
  const owners = parseOwners(ownersFile.content);
  const eligible = resolveApprovers(owners, { domain: wr.domain, path: wr.path });
  return { wr: synced, repo, owners, eligible };
}

export async function approve(input: { org: Org; approver: { user: User; membership: Membership }; requestId: string; note?: string }) {
  const { org, approver, requestId } = input;
  const { wr, repo, owners, eligible } = await loadOpen(org, requestId);
  const handle = approver.membership.handle;
  if (!eligible.includes(handle)) throw new ApproveError(`Only an owner of "${wr.domain}" can approve this ${wr.type}. Owners: ${eligible.join(", ") || "none listed in OWNERS.yaml"}.`);

  const pr = await repo.getPR(wr.prNumber);
  const paths: string[] = wr.kind === "sync" && wr.paths ? (JSON.parse(wr.paths) as string[]) : [wr.path];
  const approval = await prisma().approval.create({
    data: { writeRequestId: wr.id, orgId: org.id, approverUserId: approver.user.id, approverHandle: handle, decision: "approve", note: input.note || null, createdAt: now() },
  });
  const approvalRef = `${env.APP_URL}/orgs/${org.slug}/approvals/${approval.id}`;
  const approvedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  // An observation gets here only when a rule held it. Its file keeps approved_by null (RFC §4, and lint enforces
  // it); the Approval row and the merge commit are the record.
  const stamp = NEEDS_APPROVAL[wr.type as EntryType] ?? true;
  const writes: Array<{ path: string; content: string }> = [];
  try {
    for (const path of paths) {
      const file = await repo.readFile(path, pr.headRef);
      if (!file) throw new ApproveError(`${path} is missing from branch ${pr.headRef}.`);
      const split = splitFrontmatter(file.content);
      const parsed = split.data ? FrontmatterSchema.safeParse(split.data) : null;
      if (!parsed?.success) throw new ApproveError(`${path} on the PR branch no longer has valid frontmatter.`);
      const fm = parsed.data;
      const raw = stamp ? serializeEntry({ ...fm, approved_by: handle, approved_at: approvedAt, approval_ref: approvalRef }, split.body) : file.content;
      let siblings: Array<{ path: string; body: string }> = [];
      if (wr.kind !== "sync") {
        const dir = `${TYPE_DIR[fm.type]}/${fm.domain}/`;
        const siblingPaths = (await repo.listPaths()).filter((p) => p.startsWith(dir) && p.endsWith(".md") && p !== path);
        siblings = (await repo.readMany(siblingPaths))
          .filter((s): s is { path: string; raw: string } => typeof s.raw === "string")
          .map((s) => ({ path: s.path, body: splitFrontmatter(s.raw).body }));
      }
      const report = lint({ path, raw, owners, siblings, mode: "final", similarityThreshold: org.similarityThreshold });
      if (!report.ok) throw new ApproveError(`${path} no longer passes lint, so nothing was merged.`, report);
      if (stamp) writes.push({ path, content: raw });
    }
  } catch (e) {
    await prisma().approval.delete({ where: { id: approval.id } });
    throw e;
  }

  if (writes.length) await repo.commit({ branch: pr.headRef, message: `approve: ${handle} via reedright (${writes.length} file${writes.length === 1 ? "" : "s"})\n\napproval_ref: ${approvalRef}`, writes });
  await repo.mergePR(wr.prNumber, `${wr.type}(${wr.domain}): ${wr.title}`, `Approved by ${handle} (reedright approval ${approval.id})${stamp ? "" : "; an observation a rule held for review, so the approval is recorded in reedright only"}.\nAuthor: ${wr.handle}\nRun: ${wr.run}`);
  await regenerateManifest(repo);
  await repo.deleteBranch(pr.headRef);
  await prisma().writeRequest.update({ where: { id: wr.id }, data: { status: "merged", updatedAt: now() } });
  return { approvalId: approval.id, prUrl: wr.prUrl, approvalRef };
}

export async function reject(input: { org: Org; approver: { user: User; membership: Membership }; requestId: string; note?: string }) {
  const { org, approver, requestId } = input;
  const { wr, repo, eligible } = await loadOpen(org, requestId);
  const handle = approver.membership.handle;
  if (!eligible.includes(handle) && approver.membership.role !== "admin") throw new ApproveError(`Only an owner of "${wr.domain}" or an org admin can reject this request.`);
  const approval = await prisma().approval.create({
    data: { writeRequestId: wr.id, orgId: org.id, approverUserId: approver.user.id, approverHandle: handle, decision: "reject", note: input.note || null, createdAt: now() },
  });
  await repo.comment(wr.prNumber, `Rejected by **${handle}** via reedright${input.note ? `: ${input.note}` : "."}\n\n${env.APP_URL}/orgs/${org.slug}/approvals/${approval.id}`);
  await repo.closePR(wr.prNumber);
  await repo.deleteBranch(wr.branch);
  await prisma().writeRequest.update({ where: { id: wr.id }, data: { status: "rejected", updatedAt: now() } });
  if (wr.kind === "sync") {
    // Forget what this PR claimed so the next run re-proposes it.
    await prisma().driveSyncItem.updateMany({ where: { requestId: wr.id, archivedAt: null }, data: { modifiedTime: "", requestId: null } });
    await prisma().driveSyncItem.updateMany({ where: { requestId: wr.id, NOT: { archivedAt: null } }, data: { archivedAt: null, requestId: null } });
  }
  return { approvalId: approval.id };
}
