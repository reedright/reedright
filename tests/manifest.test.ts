import { describe, expect, it } from "vitest";
import { entriesFromFiles, parseManifest, renderManifest } from "~/lib/brain/manifest";
import { observation, rule, approved } from "./fixtures";

describe("manifest", () => {
  it("builds, renders, and parses back", () => {
    const files = [
      observation(),
      rule(approved),
      { path: "archive/observations/marketing/2026-08-01-old.md", raw: observation({ created: "2026-08-01", review_by: "2026-08-30" }).raw },
      { path: "observations/ops/.gitkeep", raw: "" },
      { path: "observations/ops/2026-09-15-broken.md", raw: "no frontmatter" },
    ];
    const { entries, skipped } = entriesFromFiles(files);
    expect(entries).toHaveLength(3);
    expect(skipped).toEqual([{ path: "observations/ops/2026-09-15-broken.md", reason: expect.any(String) }]);
    const md = renderManifest(entries, "2026-09-15T12:00:00Z", skipped);
    expect(md).toContain("## rules (1)");
    expect(md).toContain("## observations (1)");
    expect(md).toContain("## archive (1)");
    expect(md).toContain("| rules/marketing/2026-09-15-brand-voice.md | marketing | Brand voice | growth-lead | 2026-09-15 | 2027-03-14 | growth-lead |");
    const back = parseManifest(md);
    expect(back.map((e) => e.path).sort()).toEqual(entries.map((e) => e.path).sort());
    expect(back.find((e) => e.type === "rule")?.approved_by).toBe("growth-lead");
    expect(back.find((e) => e.type === "observation" && !e.archived)?.approved_by).toBeNull();
    expect(back.find((e) => e.archived)?.title).toBe("Klaviyo flows renamed");
  });
  it("escapes pipes in titles", () => {
    const { entries } = entriesFromFiles([observation({}, "# A | B\n\nbody")]);
    const md = renderManifest(entries, "now");
    expect(md).toContain("A \\| B");
    expect(parseManifest(md)[0].title).toBe("A | B");
  });
});
