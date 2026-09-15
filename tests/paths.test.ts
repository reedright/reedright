import { describe, expect, it } from "vitest";
import { archivePath, entryPath, isEntryPath, parseEntryPath } from "~/lib/brain/paths";

describe("paths", () => {
  it("builds and parses entry paths", () => {
    const p = entryPath("observation", "marketing", "2026-09-15", "klaviyo-flows");
    expect(p).toBe("observations/marketing/2026-09-15-klaviyo-flows.md");
    expect(parseEntryPath(p)).toEqual({ type: "observation", domain: "marketing", filename: "2026-09-15-klaviyo-flows.md", archived: false });
    expect(parseEntryPath("archive/rules/ops/x.md")).toMatchObject({ type: "rule", archived: true });
    expect(parseEntryPath("rules/ops/.gitkeep")).toBeNull();
    expect(parseEntryPath("MANIFEST.md")).toBeNull();
    expect(parseEntryPath("rules/x.md")).toBeNull();
    expect(isEntryPath("archive/rules/ops/x.md")).toBe(false);
    expect(archivePath("rules/ops/x.md")).toBe("archive/rules/ops/x.md");
  });
  it("rejects bad slugs", () => {
    expect(() => entryPath("rule", "ops", "2026-09-15", "Bad Slug")).toThrow();
  });
});
