// RFC §5 lint. Pure function: give it the file, OWNERS.yaml, and siblings; get a report. CI-independent.
import { splitFrontmatter, titleOf } from "./frontmatter";
import { resolveApprovers, type Owners } from "./owners";
import { MANIFEST_PATH, parseEntryPath } from "./paths";
import { mostSimilar, type Similar } from "./similarity";
import {
  FrontmatterSchema, FRONTMATTER_KEYS, NEEDS_APPROVAL, OBSERVATION_MAX_REVIEW_DAYS, OBSERVATION_MAX_WORDS,
  daysBetween, todayUTC, type Frontmatter,
} from "./schema";

export type LintMode = "proposal" | "final";

export interface LintInput {
  path: string;
  raw: string;
  owners: Owners;
  /** Other files in the same type/domain directory, for the similarity check. */
  siblings?: Array<{ path: string; body: string }>;
  mode: LintMode;
  similarityThreshold?: number;
  today?: string;
}

export interface LintIssue {
  rule: string;
  message: string;
}

export interface LintReport {
  ok: boolean;
  errors: LintIssue[];
  warnings: LintIssue[];
  frontmatter: Frontmatter | null;
  body: string;
  similarity: Similar | null;
}

const GIT_URL_RE = /(github\.com|gitlab\.com|bitbucket\.org|\.git(\b|$)|^git@|^git:\/\/)/i;

/** Numbers that look like metrics. Applied to rule and observation bodies only (RFC §5). */
export function findMetricLikeNumbers(body: string): string[] {
  const scrubbed = body
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?Z?)?\b/g, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ");
  const patterns = [
    /\d+(?:\.\d+)?\s?%/g,
    /[$€£]\s?\d[\d,]*(?:\.\d+)?/g,
    /\b\d+(?:\.\d+)?\s?[kKmMbB]\b/g,
    /\b\d{1,3}(?:,\d{3})+\b/g,
    /\b\d{5,}\b/g,
    /\b\d{3,}\.\d+\b/g,
  ];
  const hits = new Set<string>();
  for (const p of patterns) for (const m of scrubbed.matchAll(p)) hits.add(m[0].trim());
  return [...hits];
}

export function wordCount(body: string): number {
  return body.replace(/^#\s+.*$/m, "").split(/\s+/).filter(Boolean).length;
}

export function lint(input: LintInput): LintReport {
  const errors: LintIssue[] = [];
  const warnings: LintIssue[] = [];
  const today = input.today ?? todayUTC();
  const err = (rule: string, message: string) => errors.push({ rule, message });
  const warn = (rule: string, message: string) => warnings.push({ rule, message });

  if (input.path === MANIFEST_PATH) {
    err("manifest.hand-edit", "MANIFEST.md is generated on merge. Do not edit it by hand.");
    return { ok: false, errors, warnings, frontmatter: null, body: input.raw, similarity: null };
  }

  const split = splitFrontmatter(input.raw);
  if (!split.data) {
    err("frontmatter.present", split.error ?? "frontmatter missing");
    return { ok: false, errors, warnings, frontmatter: null, body: split.body, similarity: null };
  }
  const body = split.body;

  for (const k of Object.keys(split.data)) {
    if (!(FRONTMATTER_KEYS as readonly string[]).includes(k)) warn("frontmatter.unknown-key", `unknown key "${k}" (allowed, but not part of the schema)`);
  }

  const parsed = FrontmatterSchema.safeParse(split.data);
  if (!parsed.success) {
    for (const i of parsed.error.issues) err("frontmatter.schema", `${i.path.join(".") || "(root)"}: ${i.message}`);
    return { ok: false, errors, warnings, frontmatter: null, body, similarity: null };
  }
  const fm = parsed.data;

  const pp = parseEntryPath(input.path);
  if (!pp || pp.archived) {
    err("path.matches-type-domain", `path "${input.path}" is not <type-dir>/<domain>/<file>.md`);
  } else {
    if (pp.type !== fm.type) err("path.matches-type-domain", `path says type "${pp.type}" but frontmatter says "${fm.type}"`);
    if (pp.domain !== fm.domain) err("path.matches-type-domain", `path says domain "${pp.domain}" but frontmatter says "${fm.domain}"`);
  }

  if (!input.owners.domains[fm.domain]) {
    err("domain.known", `domain "${fm.domain}" is not in OWNERS.yaml (known: ${Object.keys(input.owners.domains).join(", ") || "none"})`);
  }

  if (fm.type === "ref") {
    if (!fm.system) err("ref.requires-system-locator", "a ref must have `system`");
    if (!fm.locator) err("ref.requires-system-locator", "a ref must have `locator`");
  }

  if (fm.approval_ref && GIT_URL_RE.test(fm.approval_ref)) {
    err("approval.ref-not-git", "approval_ref must point to the approval event (a message, ticket, or form), not a git or GitHub URL");
  }

  if (NEEDS_APPROVAL[fm.type]) {
    const has = fm.approved_by && fm.approved_at && fm.approval_ref;
    if (input.mode === "final" && !has) {
      err("approval.required", `a ${fm.type} needs approved_by, approved_at, and approval_ref before merge`);
    }
    if (fm.approved_by) {
      const eligible = resolveApprovers(input.owners, { domain: fm.domain, path: input.path });
      if (!eligible.includes(fm.approved_by)) {
        err("approval.approver-is-owner", `approved_by "${fm.approved_by}" is not an owner of "${fm.domain}" (owners: ${eligible.join(", ") || "none"})`);
      }
    }
  } else if (fm.approved_by || fm.approved_at || fm.approval_ref) {
    err("observation.no-approval", "an observation has no approver; leave approved_by, approved_at, approval_ref null");
  }

  if (fm.type === "rule" || fm.type === "observation") {
    const hits = findMetricLikeNumbers(body);
    if (hits.length) err("metric.absent", `looks like it contains metrics (${hits.slice(0, 5).join(", ")}). Point to a ref instead.`);
  }

  if (fm.review_by < today) err("review_by.future", `review_by ${fm.review_by} is in the past (today ${today})`);
  if (fm.type === "observation") {
    const span = daysBetween(fm.created, fm.review_by);
    if (span > OBSERVATION_MAX_REVIEW_DAYS) err("review_by.observation-window", `an observation's review_by must be within ${OBSERVATION_MAX_REVIEW_DAYS} days of created (got ${span})`);
    const words = wordCount(body);
    if (words > OBSERVATION_MAX_WORDS) err("observation.word-limit", `observation has ${words} words; the limit is ${OBSERVATION_MAX_WORDS}`);
  }

  if (!titleOf(body)) warn("body.title", "body has no `# Title` heading; MANIFEST will use the filename");

  let similarity: Similar | null = null;
  if (input.siblings?.length) {
    similarity = mostSimilar(body, input.siblings.filter((s) => s.path !== input.path));
    const threshold = input.similarityThreshold ?? 0.9;
    if (similarity && similarity.score >= threshold) {
      err("similarity.duplicate", `${Math.round(similarity.score * 100)}% similar to ${similarity.path}. Supersede it instead of adding a near-duplicate.`);
    } else if (similarity && similarity.score >= threshold - 0.2) {
      warn("similarity.near", `${Math.round(similarity.score * 100)}% similar to ${similarity.path}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, frontmatter: fm, body, similarity };
}
