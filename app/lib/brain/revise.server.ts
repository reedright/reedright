// brain_revise: the author edits an open (not yet approved) rule, procedure, or ref. Re-lints, commits to the PR branch.
import { prisma, now } from "../db.server";
import { env } from "../env.server";
import { BrainRepo } from "../github/repo.server";
import type { TokenContext } from "../tokens.server";
import { syncStatus } from "./approve.server";
import { serializeEntry, splitFrontmatter, titleOf } from "./frontmatter";
import { lint } from "./lint";
import { parseOwners, resolveApprovers } from "./owners";
import { OWNERS_PATH } from "./paths";
import { ProposeError, type ProposeResult } from "./propose.server";
import { FrontmatterSchema, TYPE_DIR, isValidDate } from "./schema";

export interface ReviseInput {
  request_id: string;
  title?: string;
  body?: string;
  source?: string;
  review_by?: string;
  system?: string;
  locator?: string;
}

export async function revise(ctx: TokenContext, input: ReviseInput): Promise<ProposeResult> {
  const { org, membership } = ctx;
  const wr = await prisma().writeRequest.findUnique({ where: { id: input.request_id } });
  if (!wr || wr.orgId !== org.id) throw new ProposeError("No such write request in this organization.");
  if (wr.handle !== membership.handle) throw new ProposeError(`Only the author (${wr.handle}) can revise this request. You are ${membership.handle}.`);
  const repo = await BrainRepo.forOrg(org);
  const synced = await syncStatus(repo, wr);
  if (synced.status !== "open") throw new ProposeError(`This request is ${synced.status}. Only open requests can be revised; to change a merged entry, propose a new one with supersedes set to its path.`);

  const pr = await repo.getPR(wr.prNumber);
  const file = await repo.readFile(wr.path, pr.headRef);
  if (!file) throw new ProposeError(`${wr.path} is missing from branch ${pr.headRef}.`);
  const split = splitFrontmatter(file.content);
  const parsed = split.data ? FrontmatterSchema.safeParse(split.data) : null;
  if (!parsed?.success) throw new ProposeError("The file on the PR branch no longer has valid frontmatter.");
  const current = parsed.data;

  const currentTitle = titleOf(split.body) ?? wr.title;
  const currentBody = split.body.replace(/^#\s+.*\r?\n?/, "").trim();
  const title = (input.title ?? currentTitle).trim();
  const body = (input.body ?? currentBody).trim();
  if (input.review_by && !isValidDate(input.review_by)) throw new ProposeError("review_by must be a valid YYYY-MM-DD date.");
  const fm = {
    ...current,
    source: input.source?.trim() || current.source,
    review_by: input.review_by ?? current.review_by,
    ...(current.type === "ref" ? { system: input.system?.trim() || current.system, locator: input.locator?.trim() || current.locator } : {}),
  };
  const raw = serializeEntry(fm, `# ${title}\n\n${body}`);
  if (raw === file.content) throw new ProposeError("Nothing changed. Pass at least one field with a new value.");

  const ownersFile = await repo.readFile(OWNERS_PATH);
  if (!ownersFile) throw new ProposeError("OWNERS.yaml is missing from the brain repository.");
  const owners = parseOwners(ownersFile.content);
  const dir = `${TYPE_DIR[fm.type]}/${fm.domain}/`;
  const siblingPaths = (await repo.listPaths()).filter((p) => p.startsWith(dir) && p.endsWith(".md") && p !== wr.path);
  const siblings = (await repo.readMany(siblingPaths))
    .filter((s): s is { path: string; raw: string } => typeof s.raw === "string")
    .map((s) => ({ path: s.path, body: splitFrontmatter(s.raw).body }));
  const report = lint({ path: wr.path, raw, owners, siblings, mode: "proposal", similarityThreshold: org.similarityThreshold });
  if (!report.ok) throw new ProposeError("Lint failed. Fix the errors and revise again.", report);

  await repo.commit({ branch: pr.headRef, message: `revise: ${title}\n\nAuthor: ${membership.handle} (reedright)`, writes: [{ path: wr.path, content: raw }] });
  if (title !== wr.title) await repo.updatePR(wr.prNumber, { title: `[${wr.type}/${wr.domain}] ${title}` });
  await prisma().writeRequest.update({
    where: { id: wr.id },
    data: { title, lintReport: JSON.stringify({ errors: report.errors, warnings: report.warnings, similarity: report.similarity }), updatedAt: now() },
  });
  const approvers = resolveApprovers(owners, { domain: wr.domain, path: wr.path });
  return {
    request_id: wr.id, path: wr.path, pr_number: wr.prNumber, pr_url: wr.prUrl, review_url: `${env.APP_URL}/orgs/${org.slug}/requests/${wr.id}`, status: "open", approvers,
    warnings: report.warnings.map((w) => `${w.rule}: ${w.message}`),
    message: `Revised. The pull request has a new commit and still needs approval from an owner of ${wr.domain}: ${approvers.join(", ") || "nobody listed in OWNERS.yaml"}.`,
  };
}
