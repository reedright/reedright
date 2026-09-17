// brain_propose: lint -> branch -> one commit -> PR -> (observation: merge + manifest). RFC §6 writes.
import { randomBytes } from "node:crypto";
import { prisma, now } from "../db.server";
import { env } from "../env.server";
import { BrainRepo, REEDRIGHT_LABELS } from "../github/repo.server";
import type { TokenContext } from "../tokens.server";
import { serializeEntry, splitFrontmatter } from "./frontmatter";
import { lint, type LintReport } from "./lint";
import { regenerateManifest } from "./manifest.server";
import { parseOwners, resolveApprovers } from "./owners";
import { OWNERS_PATH, archivePath, entryPath } from "./paths";
import { describeHit, evaluateRules, parseEnabledRules, type RuleHit } from "./rules";
import { DEFAULT_REVIEW_DAYS, NEEDS_APPROVAL, TYPE_DIR, addDays, todayUTC, type EntryType, type Frontmatter } from "./schema";

export interface ProposeInput {
  type: EntryType;
  domain: string;
  slug: string;
  title: string;
  body: string;
  source: string;
  run?: string;
  review_by?: string;
  supersedes?: string | null;
  system?: string;
  locator?: string;
}

export interface ProposeResult {
  request_id: string;
  path: string;
  pr_number: number;
  pr_url: string;
  /** The reedright review page for this request (rendered files, diffs, approve/reject). */
  review_url: string;
  status: "open" | "merged";
  approvers: string[];
  warnings: string[];
  /** What the org's rules matched. A flagged observation is held for review instead of merging. */
  flags: RuleHit[];
  message: string;
}

export class ProposeError extends Error {
  constructor(
    message: string,
    public report: LintReport | null = null,
  ) {
    super(message);
  }
}

const shortId = () => randomBytes(4).toString("hex");

function prBody(input: { handle: string; fm: Frontmatter; path: string; approvers: string[]; report: LintReport; flags: RuleHit[]; orgSlug: string; requestId: string }): string {
  const { handle, fm, path, approvers, report, flags, orgSlug, requestId } = input;
  const held = !NEEDS_APPROVAL[fm.type] && flags.length > 0;
  const needsReview = NEEDS_APPROVAL[fm.type] || held;
  const rows: Array<[string, string]> = [
    ["type", fm.type],
    ["domain", fm.domain],
    ["path", `\`${path}\``],
    ["author", `\`${handle}\` (reedright handle)`],
    ["run", `\`${fm.run}\``],
    ["source", fm.source],
    ["review_by", fm.review_by],
  ];
  if (fm.supersedes) rows.push(["supersedes", `\`${fm.supersedes}\` (moved to archive/)`]);
  if (needsReview) rows.push(["can approve", approvers.map((a) => `\`${a}\``).join(", ") || "nobody (fix OWNERS.yaml)"]);
  const lines = [
    `Proposed by **${handle}** via reedright.`,
    "",
    "| | |",
    "| --- | --- |",
    ...rows.map(([k, v]) => `| ${k} | ${v} |`),
    "",
    `Lint: passed${report.warnings.length ? ` with ${report.warnings.length} warning(s)` : ""}.`,
    ...report.warnings.map((w) => `- ${w.rule}: ${w.message}`),
    ...(flags.length ? ["", `Review flags (${flags.length}), from the rules this organization turned on:`, ...flags.map((f) => `- ${describeHit(f)}`)] : []),
    "",
    held
      ? `This observation is held for review because a rule flagged it. An owner of ${fm.domain} approves or rejects at ${env.APP_URL}/orgs/${orgSlug}/approvals (request \`${requestId}\`); the approval is recorded in reedright and the file keeps approved_by null, as an observation must.`
      : needsReview
        ? `Approve or reject at ${env.APP_URL}/orgs/${orgSlug}/approvals (request \`${requestId}\`). The record of approval is written into the file's frontmatter; this PR is not the record.`
        : "Observations merge automatically when lint passes (RFC §3).",
  ];
  return lines.join("\n");
}

export async function propose(ctx: TokenContext, input: ProposeInput): Promise<ProposeResult> {
  const { org, user, membership, token } = ctx;
  const repo = await BrainRepo.forOrg(org);
  const today = todayUTC();
  const handle = membership.handle;
  const run = input.run?.trim() || `mcp-${token.prefix}-${new Date().toISOString()}`;
  const fm: Frontmatter = {
    type: input.type,
    domain: input.domain,
    author: handle,
    run,
    source: input.source,
    created: today,
    review_by: input.review_by ?? addDays(today, DEFAULT_REVIEW_DAYS[input.type]),
    approved_by: null,
    approved_at: null,
    approval_ref: null,
    supersedes: input.supersedes ?? null,
    ...(input.type === "ref" ? { system: input.system, locator: input.locator } : {}),
  };
  let path: string;
  try {
    path = entryPath(input.type, input.domain, today, input.slug);
  } catch (e) {
    throw new ProposeError((e as Error).message);
  }
  const body = `# ${input.title.trim()}\n\n${input.body.trim()}`;
  const raw = serializeEntry(fm, body);

  const ownersFile = await repo.readFile(OWNERS_PATH);
  if (!ownersFile) throw new ProposeError("The brain repository has no OWNERS.yaml. An admin must scaffold it first.");
  const owners = parseOwners(ownersFile.content);
  const allPaths = await repo.listPaths();
  if (allPaths.includes(path)) throw new ProposeError(`${path} already exists today. Pick a different slug, or set supersedes to replace it.`);
  if (fm.supersedes && !allPaths.includes(fm.supersedes)) throw new ProposeError(`supersedes target ${fm.supersedes} does not exist on ${repo.defaultBranch}.`);

  const dir = `${TYPE_DIR[input.type]}/${input.domain}/`;
  const siblingPaths = allPaths.filter((p) => p.startsWith(dir) && p.endsWith(".md"));
  const siblings = (await repo.readMany(siblingPaths))
    .filter((s): s is { path: string; raw: string } => typeof s.raw === "string")
    .map((s) => ({ path: s.path, body: splitFrontmatter(s.raw).body }));

  const report = lint({ path, raw, owners, siblings, mode: "proposal", similarityThreshold: org.similarityThreshold, today });
  if (!report.ok) throw new ProposeError("Lint failed. Fix the errors and propose again.", report);

  const baseSha = await repo.headSha();
  if (!baseSha) throw new ProposeError("The brain repository is empty. An admin must scaffold it first.");
  const branch = `reedright/${handle}/${shortId()}`;
  await repo.createBranch(branch, baseSha);
  const writes = [{ path, content: raw }];
  const deletes: string[] = [];
  if (fm.supersedes) {
    const old = await repo.readFile(fm.supersedes);
    if (old) {
      writes.push({ path: archivePath(fm.supersedes), content: old.content });
      deletes.push(fm.supersedes);
    }
  }
  const commitTitle = `${input.type}(${input.domain}): ${input.title.trim()}`;
  await repo.commit({ branch, message: `${commitTitle}\n\nAuthor: ${handle} (reedright)\nRun: ${run}`, writes, deletes });

  // The org's rules, run here on the same content CI will see, so a flag is known before the PR exists.
  const flags = evaluateRules(parseEnabledRules(org.enabledRules), writes);
  const held = !NEEDS_APPROVAL[input.type] && flags.length > 0;
  const needsReview = NEEDS_APPROVAL[input.type] || held;
  const approvers = needsReview ? resolveApprovers(owners, { domain: input.domain, path }) : [];
  const requestId = `wr_${shortId()}${shortId()}`;
  await repo.ensureLabels(REEDRIGHT_LABELS);
  const pr = await repo.openPR({
    title: `[${input.type}/${input.domain}] ${input.title.trim()}`,
    body: prBody({ handle, fm, path, approvers, report, flags, orgSlug: org.slug, requestId }),
    head: branch,
  });
  await repo.addLabels(pr.number, ["reedright", `type:${input.type}`, ...(flags.length ? ["flagged"] : [])]);

  const ts = now();
  await prisma().writeRequest.create({
    data: {
      id: requestId, orgId: org.id, userId: user.id, handle, run, type: input.type, domain: input.domain, title: input.title.trim(),
      path, branch, prNumber: pr.number, prUrl: pr.htmlUrl, status: "open",
      lintReport: JSON.stringify({ errors: report.errors, warnings: report.warnings, similarity: report.similarity }),
      flags: flags.length ? JSON.stringify(flags) : null,
      createdAt: ts, updatedAt: ts,
    },
  });

  const warnings = report.warnings.map((w) => `${w.rule}: ${w.message}`);
  if (!needsReview) {
    await repo.mergePR(pr.number, commitTitle, `Auto-merged by reedright: observation passed lint.\n\nAuthor: ${handle}\nRun: ${run}`);
    await regenerateManifest(repo);
    await repo.deleteBranch(branch);
    await prisma().writeRequest.update({ where: { id: requestId }, data: { status: "merged", updatedAt: now() } });
    return { request_id: requestId, path, pr_number: pr.number, pr_url: pr.htmlUrl, review_url: `${env.APP_URL}/orgs/${org.slug}/requests/${requestId}`, status: "merged", approvers: [], warnings, flags: [], message: `Observation merged to ${repo.defaultBranch} as ${path}. MANIFEST.md updated.` };
  }
  const flagged = flags.map(describeHit).join("; ");
  const who = approvers.join(", ") || "nobody listed in OWNERS.yaml";
  return {
    request_id: requestId, path, pr_number: pr.number, pr_url: pr.htmlUrl, review_url: `${env.APP_URL}/orgs/${org.slug}/requests/${requestId}`, status: "open", approvers, warnings, flags,
    message: held
      ? `Observation held for review, not merged: ${flagged}. An owner of ${input.domain} (${who}) approves or rejects at ${env.APP_URL}/orgs/${org.slug}/approvals, or call brain_revise to fix it; it merges on its own once no rule flags it.`
      : (approvers.length
          ? `Pull request opened. A ${input.type} needs approval from an owner of ${input.domain}: ${approvers.join(", ")}. They approve at ${env.APP_URL}/orgs/${org.slug}/approvals.`
          : `Pull request opened, but OWNERS.yaml lists no owner for ${input.domain}. An admin must fix OWNERS.yaml before anyone can approve.`) + (flags.length ? ` Flagged for review: ${flagged}.` : ""),
  };
}
