import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import {
  REGEX_RULE_SCRIPT, RULES, RULES_WORKFLOW_PATH, checkName, describeHit, evaluateRules, parseEnabledRules, parseFlags, renderRulesWorkflow, ruleById, serializeEnabledRules,
} from "~/lib/brain/rules";

const dollars = ruleById("flag-dollar-figures")!;

describe("rules: registry", () => {
  it("knows the dollar-figure rule, with an id that is a valid workflow job id", () => {
    expect(dollars.name).toBe("Flag dollar figures");
    for (const r of RULES) expect(r.id).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(RULES_WORKFLOW_PATH).toMatch(/^\.github\/workflows\//);
  });
  it("reads the org's enabled ids tolerantly and keeps registry order", () => {
    expect(parseEnabledRules('["nope","flag-dollar-figures"]').map((r) => r.id)).toEqual(["flag-dollar-figures"]);
    expect(parseEnabledRules("garbage")).toEqual([]);
    expect(parseEnabledRules(null)).toEqual([]);
    expect(serializeEnabledRules([dollars])).toBe('["flag-dollar-figures"]');
    expect(parseFlags(null)).toEqual([]);
    expect(parseFlags("{")).toEqual([]);
  });
});

describe("rules: flag dollar figures", () => {
  const files = (content: string, path = "procedures/ops/2026-09-16-refunds.md") => [{ path, content }];
  it("matches $xx.xx forms and reports 1-based lines", () => {
    const hits = evaluateRules([dollars], files("# Refunds\n\nRefund up to $12.50 or $1,200.00 per order.\nA cap of $ 5 applies.\n"));
    expect(hits.map((h) => [h.line, h.match])).toEqual([[3, "$12.50"], [3, "$1,200.00"], [4, "$ 5"]]);
    expect(hits[0]).toMatchObject({ rule: "flag-dollar-figures", path: "procedures/ops/2026-09-16-refunds.md" });
    expect(describeHit(hits[0])).toBe('Flag dollar figures: "$12.50" at procedures/ops/2026-09-16-refunds.md:3');
  });
  it("ignores plain numbers, other currencies, archived and non-entry files", () => {
    expect(evaluateRules([dollars], files("12.50 dollars, €12.50, 100%, US dollars"))).toEqual([]);
    expect(evaluateRules([dollars], files("$12.50", "archive/procedures/ops/2026-09-16-refunds.md"))).toEqual([]);
    expect(evaluateRules([dollars], files("$12.50", "README.md"))).toEqual([]);
    expect(evaluateRules([dollars], files("$12.50", "OWNERS.yaml"))).toEqual([]);
  });
  it("does nothing when no rules are on", () => {
    expect(evaluateRules([], files("$12.50"))).toEqual([]);
  });
});

describe("rules: workflow", () => {
  const yml = renderRulesWorkflow({ defaultBranch: "main", rules: [dollars] });
  const doc = YAML.parse(yml) as Record<string, any>;
  it("is valid YAML that runs one job per enabled rule on pull requests to the default branch", () => {
    expect(doc.on.pull_request.branches).toEqual(["main"]);
    expect(doc.permissions).toEqual({ contents: "read" });
    expect(Object.keys(doc.jobs)).toEqual(["flag-dollar-figures"]);
    const job = doc.jobs["flag-dollar-figures"];
    expect(job.name).toBe(checkName(dollars));
    expect(job.steps[0].uses).toBe("actions/checkout@v4");
    expect(job.steps[0].with["fetch-depth"]).toBe(0);
    const step = job.steps.find((s: Record<string, unknown>) => s.run)!;
    expect(step.env.PATTERN).toBe(dollars.pattern);
    expect(step.env.TITLE).toBe(dollars.name);
    expect(step.env.BASE_SHA).toBe("${{ github.event.pull_request.base.sha }}");
    expect(step.run).toBe(REGEX_RULE_SCRIPT);
  });
  it("renders no jobs when no rules are on", () => {
    expect(YAML.parse(renderRulesWorkflow({ defaultBranch: "main", rules: [] })).jobs).toBeNull();
  });
});

describe("rules: the CI step", () => {
  // A throwaway repository. main has an entry with a dollar figure; a branch adds a procedure with two and a clean
  // observation, and touches the README. Only the new procedure's lines may be flagged.
  const dir = mkdtempSync(join(tmpdir(), "reedright-rules-"));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" };
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, env, stdio: "pipe" }).toString().trim();
  const write = (rel: string, content: string) => {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  };
  git("init", "-q", "-b", "main");
  write("procedures/ops/2026-09-01-old.md", "# Old\n\nWas $99 once.\n");
  git("add", "."); git("commit", "-qm", "base");
  const base = git("rev-parse", "HEAD");

  git("checkout", "-qb", "reedright/bamboo/abc");
  const proposal = "# Refunds\n\nRefund up to $12.50 per order.\nNever more than $1,200.\n";
  write("procedures/ops/2026-09-16-refunds.md", proposal);
  write("observations/ops/2026-09-16-clean.md", "# Clean\n\nNo money here.\n");
  write("README.md", "$5 in the README is fine\n");
  git("add", "."); git("commit", "-qm", "proposal");
  const flagged = git("rev-parse", "HEAD");

  git("checkout", "-q", "main");
  git("checkout", "-qb", "reedright/bamboo/def");
  write("observations/ops/2026-09-16-clean.md", "# Clean\n\nNo money here either.\n");
  git("add", "."); git("commit", "-qm", "clean proposal");
  const clean = git("rev-parse", "HEAD");

  const run = (headSha: string) => {
    git("checkout", "-q", headSha);
    return spawnSync("bash", ["-c", REGEX_RULE_SCRIPT], { cwd: dir, env: { ...env, PATTERN: dollars.pattern, TITLE: dollars.name, BASE_SHA: base, HEAD_SHA: headSha }, encoding: "utf8" });
  };

  it("fails and annotates each match in a changed entry file", () => {
    const r = run(flagged);
    expect(r.stderr).toBe("");
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("::error file=procedures/ops/2026-09-16-refunds.md,line=3,title=Flag dollar figures::$12.50");
    expect(r.stdout).toContain("::error file=procedures/ops/2026-09-16-refunds.md,line=4,title=Flag dollar figures::$1,200");
    expect(r.stdout).toContain("2 match(es) in 2 changed file(s)");
    expect(r.stdout).not.toContain("README");
    expect(r.stdout).not.toContain("$99");
  });
  it("agrees with reedright's own evaluation of the same file", () => {
    const r = run(flagged);
    const ci = [...r.stdout.matchAll(/::error file=(.+?),line=(\d+),title=.*?::(.*)/g)].map((m) => ({ path: m[1], line: Number(m[2]), match: m[3] }));
    const here = evaluateRules([dollars], [{ path: "procedures/ops/2026-09-16-refunds.md", content: proposal }]).map(({ path, line, match }) => ({ path, line, match }));
    expect(ci).toEqual(here);
  });
  it("passes when nothing the pull request changes matches", () => {
    const r = run(clean);
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("nothing flagged in 1 changed file(s)");
  });
});
