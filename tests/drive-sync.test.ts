import { describe, expect, it } from "vitest";
import { MAX_CHARS, modeFor, prBody, prTitle, refPathFor, renderRef, slugifyName, statsOf, stripEmbeddedImages, truncate } from "~/lib/brain/drive-sync";
import { splitFrontmatter } from "~/lib/brain/frontmatter";
import { lint } from "~/lib/brain/lint";
import { TODAY, owners } from "./fixtures";

const file = { id: "1AbC_def-GHIjklMNOP", name: "Brand voice.gdoc", mimeType: "application/vnd.google-apps.document", modifiedTime: "2026-09-10T10:00:00.000Z", size: null, md5Checksum: null, webViewLink: "https://docs.google.com/document/d/1AbC_def-GHIjklMNOP/edit", drivePath: "Marketing/Brand/Brand voice.gdoc" };

describe("drive sync: modes and paths", () => {
  it("picks an ingestion mode by type and size", () => {
    expect(modeFor("application/vnd.google-apps.document", null)).toBe("export-markdown");
    expect(modeFor("application/vnd.google-apps.spreadsheet", null)).toBe("export-csv");
    expect(modeFor("application/vnd.google-apps.presentation", null)).toBe("export-text");
    expect(modeFor("application/vnd.google-apps.form", null)).toBe("pointer");
    expect(modeFor("text/markdown", 1200)).toBe("download-text");
    expect(modeFor("application/json", 1200)).toBe("download-text");
    expect(modeFor("text/plain", 50 * 1024 * 1024)).toBe("pointer");
    expect(modeFor("application/pdf", 1200)).toBe("pointer");
    expect(modeFor("image/png", 1200)).toBe("pointer");
  });
  it("derives a stable, lint-safe ref path", () => {
    const p = refPathFor("marketing", file);
    expect(p).toBe("refs/marketing/gdrive-brand-voice-1abcxdef.md");
    expect(refPathFor("marketing", file)).toBe(p);
    expect(slugifyName("  Q3 Plan (final) v2.docx ")).toBe("q3-plan-final-v2");
    expect(slugifyName("!!!")).toBe("file");
  });
  it("truncates very long content with a marker", () => {
    const t = truncate("x".repeat(MAX_CHARS + 500));
    expect(t.truncated).toBe(500);
    expect(t.text).toContain("500 characters omitted");
  });
});

describe("drive sync: rendered refs pass lint", () => {
  const base = { file, domain: "marketing", handle: "cameron", run: "drive-sync-abc123-2026-09-15T00:00:00.000Z", created: TODAY, syncedAt: "2026-09-15T00:00:00.000Z" };
  it("with exported content", () => {
    const raw = renderRef({ ...base, mode: "export-markdown", content: "# Voice\n\nWrite like a friend. Revenue was $12,300 last week." });
    const path = refPathFor("marketing", file);
    const r = lint({ path, raw, owners, mode: "proposal", today: TODAY });
    expect(r.errors).toEqual([]);
    const fm = splitFrontmatter(raw).data!;
    expect(fm.system).toBe("gdrive");
    expect(fm.locator).toBe("https://www.googleapis.com/drive/v3/files/1AbC_def-GHIjklMNOP");
    expect(fm.source).toBe(file.webViewLink);
    expect(fm.review_by).toBe("2027-03-14");
    expect(raw).toContain("# Brand voice.gdoc");
    expect(raw).toContain("Google Doc exported as Markdown");
    expect(raw).toContain("Revenue was $12,300"); // refs may carry numbers; rules and observations may not
  });
  it("as a pointer when content is not available", () => {
    const raw = renderRef({ ...base, mode: "pointer", content: null, contentNote: "binary or unsupported type" });
    expect(lint({ path: refPathFor("marketing", file), raw, owners, mode: "proposal", today: TODAY }).ok).toBe(true);
    expect(raw).toContain("Content not ingested: binary or unsupported type");
  });
});

describe("drive sync: pull request text", () => {
  const entries = [
    { fileId: "a", name: "Brand voice", drivePath: "Marketing/Brand voice", webViewLink: "https://docs.google.com/a", path: "refs/marketing/gdrive-brand-voice-a.md", action: "added" as const, mode: "export-markdown" as const },
    { fileId: "b", name: "Q3 | plan", drivePath: "Marketing/Q3 plan", webViewLink: "https://docs.google.com/b", path: "refs/marketing/gdrive-q3-plan-b.md", action: "updated" as const, mode: "export-csv" as const },
    { fileId: "c", name: "old.md", drivePath: "(no longer in Drive)", webViewLink: "", path: "refs/marketing/gdrive-old-c.md", action: "archived" as const, mode: "pointer" as const },
    { fileId: "d", name: "logo.png", drivePath: "Marketing/logo.png", webViewLink: "https://drive.google.com/d", path: "refs/marketing/gdrive-logo-d.md", action: "unchanged" as const, mode: "pointer" as const },
  ];
  it("summarizes and lists every document", () => {
    const stats = statsOf(entries);
    expect(stats).toEqual({ added: 1, updated: 1, archived: 1, unchanged: 1, skipped: 0 });
    expect(prTitle({ name: "Marketing" }, "marketing", stats)).toBe("[ref/marketing] Drive sync: Marketing (1 added, 1 updated, 1 archived)");
    const body = prBody({ root: { name: "Marketing", webViewLink: "https://drive.google.com/root" }, handle: "cameron", run: "r", domain: "marketing", entries, truncated: true, approvers: ["growth-lead"], orgSlug: "acmecorp", appUrl: "https://reedright.info", requestId: "wr_x" });
    expect(body).toContain("### Added (1)");
    expect(body).toContain("[Brand voice](https://docs.google.com/a)");
    expect(body).toContain("Q3 \\| plan");
    expect(body).toContain("### Archived (no longer in Drive) (1)");
    expect(body).not.toContain("logo.png");
    expect(body).toContain("per-run file limit");
    expect(body).toContain("`growth-lead`");
  });
});

describe("drive sync: embedded images", () => {
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==".repeat(3);
  it("drops Google Docs reference-style data-URI images and their definitions", () => {
    const doc = `# Plan\n\nIntro.\n\n![][image1]\n\nMore text.\n\n![Chart][image2]\n\n[image1]: <data:image/png;base64,${png}>\n\n[image2]: <data:image/jpeg;base64,${png}>\n`;
    const r = stripEmbeddedImages(doc);
    expect(r.omitted).toBe(2);
    expect(r.text).not.toContain("base64");
    expect(r.text).toContain("[image omitted]");
    expect(r.text).toContain("[image omitted: Chart]");
    expect(r.text).toContain("More text.");
    expect(r.text).not.toMatch(/\n{3,}/);
  });
  it("drops inline data-URI images, img tags, and stray base64 blobs but keeps real links", () => {
    const md = `![logo](data:image/png;base64,${png})\n<img alt="Screenshot" src="data:image/png;base64,${png}">\nSee data:image/png;base64,${png} end\n![kept](https://example.com/a.png)\n[ref]: https://example.com\n`;
    const r = stripEmbeddedImages(md);
    expect(r.omitted).toBe(3);
    expect(r.text).toContain("[image omitted: logo]");
    expect(r.text).toContain("[image omitted: Screenshot]");
    expect(r.text).toContain("See [embedded data omitted] end");
    expect(r.text).toContain("![kept](https://example.com/a.png)");
    expect(r.text).toContain("[ref]: https://example.com");
  });
  it("renders a ref without the blobs and notes how many images were left out", () => {
    const raw = renderRef({ file, domain: "marketing", handle: "cameron", run: "r", mode: "export-markdown", created: TODAY, syncedAt: "2026-09-15T00:00:00.000Z", content: `# Doc\n\n![][image1]\n\n[image1]: <data:image/png;base64,${png}>\n` });
    expect(raw).not.toContain("base64");
    expect(raw).toContain("- Images: 1 embedded image omitted");
    expect(lint({ path: refPathFor("marketing", file), raw, owners, mode: "proposal", today: TODAY }).ok).toBe(true);
  });
});
