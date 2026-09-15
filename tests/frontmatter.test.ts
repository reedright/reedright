import { describe, expect, it } from "vitest";
import { serializeEntry, splitFrontmatter, titleFromPath, titleOf } from "~/lib/brain/frontmatter";
import { observation } from "./fixtures";

describe("frontmatter", () => {
  it("round-trips through serialize and split with RFC key order", () => {
    const f = observation();
    const lines = f.raw.split("\n");
    expect(lines[0]).toBe("---");
    expect(lines[1]).toBe("type: observation");
    expect(lines[2]).toBe("domain: marketing");
    const s = splitFrontmatter(f.raw);
    expect(s.data).toMatchObject({ type: "observation", created: "2026-09-15", approved_by: null });
    expect(typeof s.data?.created).toBe("string");
    expect(s.body.startsWith("# Klaviyo flows renamed")).toBe(true);
  });
  it("reports missing and malformed frontmatter", () => {
    expect(splitFrontmatter("hello").error).toMatch(/no frontmatter/);
    expect(splitFrontmatter("---\n: :\n  - x\n---\n").error).toMatch(/valid YAML|mapping/);
    expect(splitFrontmatter("---\n- a\n---\n").error).toMatch(/mapping/);
  });
  it("omits undefined optional keys but keeps nulls", () => {
    const raw = serializeEntry({ type: "rule", domain: "ops", author: "a", run: "r", source: "s", created: "2026-09-15", review_by: "2026-12-01", approved_by: null, approved_at: null, approval_ref: null, supersedes: null }, "# T\n\nbody");
    expect(raw).toContain("approved_by: null");
    expect(raw).not.toContain("system:");
  });
  it("extracts titles", () => {
    expect(titleOf("# Hello world\n\ntext")).toBe("Hello world");
    expect(titleOf("no heading")).toBeNull();
    expect(titleFromPath("observations/marketing/2026-09-15-klaviyo-flows-renamed.md")).toBe("klaviyo flows renamed");
  });
});
