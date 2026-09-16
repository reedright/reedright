import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { QUARTZ_REF, SITE_PREP_PATH, SITE_WORKFLOW_PATH, pagesUrlFor, renderSiteWorkflow, siteFiles } from "~/lib/brain/site";
import { rule } from "./fixtures";

describe("site: workflow", () => {
  const yml = renderSiteWorkflow({ defaultBranch: "main", siteTitle: 'Acme "Corp" brain' });
  const doc = YAML.parse(yml) as Record<string, unknown>;
  it("is valid YAML that deploys on push to the default branch", () => {
    expect((doc.on as { push: { branches: string[] } }).push.branches).toEqual(["main"]);
    expect(doc.on as object).toHaveProperty("workflow_dispatch");
    expect(doc.permissions).toEqual({ contents: "read", pages: "write", "id-token": "write" });
    const jobs = doc.jobs as { build: { steps: Array<Record<string, unknown>> }; deploy: { needs: string; environment: { name: string } } };
    const steps = jobs.build.steps;
    const quartz = steps.find((s) => (s.with as { repository?: string })?.repository === "jackyzha0/quartz")!;
    expect((quartz.with as { ref: string }).ref).toBe(QUARTZ_REF);
    const prep = steps.find((s) => String(s.run ?? "").includes("site-prep"))!;
    expect(prep.run).toBe(`node brain/${SITE_PREP_PATH} brain quartz`);
    expect((prep.env as { SITE_TITLE: string }).SITE_TITLE).toBe('Acme "Corp" brain');
    expect(steps.some((s) => s.run === "npx quartz build -d ../brain -o public")).toBe(true);
    expect(jobs.deploy.needs).toBe("build");
    expect(jobs.deploy.environment.name).toBe("github-pages");
  });
  it("ships the workflow and the prep script", () => {
    const files = siteFiles({ defaultBranch: "main", siteTitle: "x" }, readFileSync(resolve("app/lib/brain/site-prep.mjs"), "utf8"));
    expect(files.map((f) => f.path)).toEqual([SITE_WORKFLOW_PATH, SITE_PREP_PATH]);
    expect(files[1].content).toContain("quartz.config.ts");
  });
  it("knows the default Pages URL", () => {
    expect(pagesUrlFor("Cam5", "smoothbrain")).toBe("https://cam5.github.io/smoothbrain/");
    expect(pagesUrlFor("cam5", "cam5.github.io")).toBe("https://cam5.github.io/");
  });
});

describe("site: prep script", () => {
  const dir = mkdtempSync(join(tmpdir(), "reedright-site-"));
  const brain = join(dir, "brain");
  const quartz = join(dir, "quartz");
  const r = rule();
  mkdirSync(join(brain, "rules/marketing"), { recursive: true });
  mkdirSync(join(brain, "archive/observations/marketing"), { recursive: true });
  mkdirSync(quartz, { recursive: true });
  writeFileSync(join(brain, r.path), r.raw);
  writeFileSync(join(brain, "archive/observations/marketing/2026-08-01-old.md"), "---\ntype: observation\ntitle: Kept\n---\n\n# Old\n\nbody\n");
  writeFileSync(join(brain, "README.md"), "# Acme brain\n\nHello.\n");
  writeFileSync(join(brain, "MANIFEST.md"), `# MANIFEST\n\nGenerated.\n\n## rules (1)\n\n| path | domain | title |\n| --- | --- | --- |\n| ${r.path} | marketing | Brand voice |\n`);
  execFileSync(process.execPath, [resolve("app/lib/brain/site-prep.mjs"), brain, quartz], { env: { ...process.env, SITE_TITLE: "Acme Corp brain", BASE_URL: "https://cam5.github.io/smoothbrain/" } });

  it("adds a title from the heading and tags from the path", () => {
    const out = readFileSync(join(brain, r.path), "utf8");
    expect(out).toMatch(/^---\ntype: rule\n/);
    expect(out).toContain('title: "Brand voice"');
    expect(out).toContain('tags: ["rules", "marketing"]');
    expect(out).not.toContain("# Brand voice");
    expect(out).toContain("Write like a friend");
  });
  it("keeps existing keys and tags archived entries", () => {
    const out = readFileSync(join(brain, "archive/observations/marketing/2026-08-01-old.md"), "utf8");
    expect(out).toContain("title: Kept");
    expect(out).not.toContain('title: "Old"');
    expect(out).toContain('tags: ["archived", "observations", "marketing"]');
  });
  it("builds a home page from the manifest with linked paths", () => {
    const index = readFileSync(join(brain, "index.md"), "utf8");
    expect(index).toContain('title: "Acme Corp brain"');
    expect(index).toContain(`| [${r.path}](${r.path}) |`);
    expect(index).not.toContain("# MANIFEST");
  });
  it("writes the Quartz config with title and base URL", () => {
    expect(existsSync(join(quartz, "quartz.config.ts"))).toBe(true);
    const cfg = readFileSync(join(quartz, "quartz.config.ts"), "utf8");
    expect(cfg).toContain('pageTitle: "Acme Corp brain"');
    expect(cfg).toContain('baseUrl: "cam5.github.io/smoothbrain"');
    expect(cfg).toContain('markdownLinkResolution: "relative"');
  });
});
