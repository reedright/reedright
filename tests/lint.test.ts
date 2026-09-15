import { describe, expect, it } from "vitest";
import { findMetricLikeNumbers, lint } from "~/lib/brain/lint";
import { TODAY, approved, observation, owners, rule } from "./fixtures";

const run = (f: { path: string; raw: string }, mode: "proposal" | "final" = "proposal", extra: Record<string, unknown> = {}) =>
  lint({ ...f, owners, mode, today: TODAY, ...extra });

const rules = (r: ReturnType<typeof lint>) => r.errors.map((e) => e.rule);

describe("lint: happy paths", () => {
  it("accepts a valid observation in both modes", () => {
    expect(run(observation()).ok).toBe(true);
    expect(run(observation(), "final").ok).toBe(true);
  });
  it("accepts an unapproved rule as a proposal, rejects it as final", () => {
    expect(run(rule()).ok).toBe(true);
    expect(rules(run(rule(), "final"))).toContain("approval.required");
  });
  it("accepts an approved rule as final", () => {
    expect(run(rule(approved), "final").ok).toBe(true);
  });
});

describe("lint: RFC §5 rules", () => {
  it("frontmatter must be present", () => {
    expect(rules(run({ path: "rules/marketing/x.md", raw: "# no frontmatter" }))).toContain("frontmatter.present");
  });
  it("all required keys present, enums valid, dates valid", () => {
    const r = run(observation({ type: "memo" as never, created: "2026-02-30" }));
    expect(rules(r)).toContain("frontmatter.schema");
    expect(r.errors.some((e) => e.message.startsWith("type"))).toBe(true);
    expect(r.errors.some((e) => e.message.startsWith("created"))).toBe(true);
  });
  it("path agrees with type and domain", () => {
    const f = observation();
    expect(rules(run({ ...f, path: "rules/marketing/x.md" }))).toContain("path.matches-type-domain");
    expect(rules(run({ ...f, path: "observations/ops/x.md" }))).toContain("path.matches-type-domain");
    expect(rules(run({ ...f, path: "archive/observations/marketing/x.md" }))).toContain("path.matches-type-domain");
  });
  it("domain must exist in OWNERS.yaml", () => {
    expect(rules(run(observation({ domain: "finance" })))).toContain("domain.known");
  });
  it("a ref needs system and locator", () => {
    const f = rule({ type: "ref" });
    const r = run({ path: "refs/marketing/2026-09-15-brand-voice.md", raw: f.raw });
    expect(rules(r)).toContain("ref.requires-system-locator");
    const ok = run({ path: "refs/marketing/2026-09-15-brand-voice.md", raw: rule({ type: "ref", system: "shopify", locator: "GET /admin/api/orders" }).raw });
    expect(ok.ok).toBe(true);
  });
  it("approved_by must be an owner of the domain", () => {
    expect(rules(run(rule({ ...approved, approved_by: "eng-lead" }), "final"))).toContain("approval.approver-is-owner");
  });
  it("refs/ path owners can approve refs too", () => {
    const f = rule({ type: "ref", system: "shopify", locator: "x", ...approved, approved_by: "eng-lead" });
    expect(run({ path: "refs/marketing/2026-09-15-brand-voice.md", raw: f.raw }, "final").ok).toBe(true);
  });
  it("approval_ref must not be a git URL", () => {
    expect(rules(run(rule({ ...approved, approval_ref: "https://github.com/x/y/pull/3" }), "final"))).toContain("approval.ref-not-git");
  });
  it("observations carry no approval", () => {
    expect(rules(run(observation({ approved_by: "bamboo" })))).toContain("observation.no-approval");
  });
  it("rules and observations must not contain metrics", () => {
    expect(rules(run(observation({}, "# Sales\n\nConversion rose to 4.2% and revenue hit $12,300 last week.")))).toContain("metric.absent");
    expect(rules(run(rule({}, "# Cap\n\nNever spend more than 10k on a single test.")))).toContain("metric.absent");
    // procedures may contain numbers
    const p = rule({ type: "procedure" }, "# Export\n\nRun the report for 30 days and pick the 95% percentile.");
    expect(rules(run({ path: "procedures/marketing/2026-09-15-brand-voice.md", raw: p.raw }))).not.toContain("metric.absent");
  });
  it("dates and small numbers are not metrics", () => {
    expect(findMetricLikeNumbers("On 2026-09-15 at 10:30 we tried 3 variants over 14 days. See https://x.y/12345.")).toEqual([]);
  });
  it("review_by must not be in the past", () => {
    expect(rules(run(observation({ created: "2026-08-01", review_by: "2026-08-20" })))).toContain("review_by.future");
  });
  it("an observation's review_by is within 30 days", () => {
    expect(rules(run(observation({ review_by: "2026-11-01" })))).toContain("review_by.observation-window");
  });
  it("an observation is 300 words or fewer", () => {
    const long = `# Long\n\n${"word ".repeat(301)}`;
    expect(rules(run(observation({}, long)))).toContain("observation.word-limit");
  });
  it("near-duplicates are rejected, similar ones warned", () => {
    const f = observation();
    const dup = run(f, "proposal", { siblings: [{ path: "observations/marketing/2026-09-01-old.md", body: "# Klaviyo flows renamed\n\nThe welcome series is now called Onboarding in Klaviyo. Old references in procedures should be read as that." }] });
    expect(rules(dup)).toContain("similarity.duplicate");
    const near = run(f, "proposal", { siblings: [{ path: "observations/marketing/2026-09-01-old.md", body: "# Klaviyo flows renamed\n\nThe welcome series is now called Onboarding in Klaviyo. Old references in procedures should be read as that. Also the cart flow moved." }] });
    expect(near.ok).toBe(true);
    expect(near.warnings.map((w) => w.rule)).toContain("similarity.near");
    const far = run(f, "proposal", { siblings: [{ path: "observations/marketing/2026-09-01-old.md", body: "# Something else entirely\n\nThe ops team changed the warehouse cutoff." }] });
    expect(far.ok).toBe(true);
    expect(far.warnings.map((w) => w.rule)).not.toContain("similarity.near");
  });
  it("MANIFEST.md cannot be edited by hand", () => {
    expect(rules(run({ path: "MANIFEST.md", raw: "# MANIFEST" }))).toContain("manifest.hand-edit");
  });
  it("warns on unknown keys and missing title", () => {
    const r = run({ path: observation().path, raw: observation().raw.replace("type: observation", "type: observation\nextra: 1").replace("# Klaviyo flows renamed\n", "") });
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.rule)).toEqual(expect.arrayContaining(["frontmatter.unknown-key", "body.title"]));
  });
});
