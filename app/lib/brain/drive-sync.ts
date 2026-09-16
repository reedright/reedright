// Pure half of Drive ingestion: how a Drive file becomes a ref entry. No I/O; unit-tested.
import type { WalkedFile } from "../google/drive.server";
import { serializeEntry } from "./frontmatter";
import type { Frontmatter } from "./schema";
import { addDays } from "./schema";

export type IngestMode = "export-markdown" | "export-csv" | "export-text" | "download-text" | "pointer";

export const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_CHARS = 200_000;
export const MAX_FILES_PER_RUN = 300;
export const MAX_DEPTH = 10;
export const REF_REVIEW_DAYS = 180;
/** Bump when renderRef's output changes so already-synced documents are re-rendered on the next run. */
export const RENDER_VERSION = 2;

const TEXT_MIMES = new Set(["application/json", "application/xml", "application/x-yaml", "application/yaml", "application/javascript", "application/x-sh", "application/sql"]);

export function modeFor(mimeType: string, size: number | null): IngestMode {
  switch (mimeType) {
    case "application/vnd.google-apps.document":
      return "export-markdown";
    case "application/vnd.google-apps.spreadsheet":
      return "export-csv";
    case "application/vnd.google-apps.presentation":
      return "export-text";
  }
  if (mimeType.startsWith("application/vnd.google-apps.")) return "pointer";
  const textLike = mimeType.startsWith("text/") || TEXT_MIMES.has(mimeType);
  if (textLike && (size == null || size <= MAX_DOWNLOAD_BYTES)) return "download-text";
  return "pointer";
}

export function exportMimeFor(mode: IngestMode): string | null {
  return { "export-markdown": "text/markdown", "export-csv": "text/csv", "export-text": "text/plain", "download-text": null, pointer: null }[mode];
}

export function describeMode(mode: IngestMode): string {
  return {
    "export-markdown": "Google Doc exported as Markdown",
    "export-csv": "Google Sheet exported as CSV (first sheet)",
    "export-text": "Google Slides exported as plain text",
    "download-text": "text file downloaded as-is",
    pointer: "pointer only (binary or unsupported type)",
  }[mode];
}

export function slugifyName(name: string): string {
  const s = name.trim().toLowerCase().replace(/\.[a-z0-9]{1,5}$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return s || "file";
}

/** Deterministic path per Drive file, so a re-sync updates in place. */
export function refPathFor(domain: string, file: { id: string; name: string }): string {
  return `refs/${domain}/gdrive-${slugifyName(file.name)}-${file.id.slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, "x")}.md`;
}

const imageMarker = (alt: string) => (alt.trim() ? `[image omitted: ${alt.trim()}]` : "[image omitted]");

/**
 * Google Docs' Markdown export embeds every image as a base64 data URI: `![][image1]` in the text and a
 * `[image1]: <data:image/png;base64,…>` definition at the end, often hundreds of KB per image. That is noise
 * for an agent and blows past the size limit, so images are replaced with a short marker. Inline data-URI images,
 * <img> tags with data sources, and any other long base64 data URI get the same treatment.
 */
export function stripEmbeddedImages(text: string): { text: string; omitted: number } {
  let omitted = 0;
  const labels = new Set<string>();
  let out = text.replace(/^[ \t]*\[([^\]\n]+)\]:[ \t]*<?data:[^\s>]+>?[ \t]*(?:\n|$)/gm, (_m, label: string) => {
    labels.add(label.toLowerCase());
    return "";
  });
  out = out.replace(/!\[([^\]\n]*)\]\[([^\]\n]*)\]/g, (m, alt: string, label: string) => {
    if (!labels.has((label || alt).toLowerCase())) return m;
    omitted++;
    return imageMarker(label ? alt : "");
  });
  out = out.replace(/!\[([^\]\n]*)\]\(\s*<?data:[^)\s]*>?(?:\s+"[^"]*")?\s*\)/g, (_m, alt: string) => {
    omitted++;
    return imageMarker(alt);
  });
  out = out.replace(/<img\b[^>]*\bsrc\s*=\s*["']data:[^"']*["'][^>]*>/gi, (m) => {
    omitted++;
    return imageMarker(/\balt\s*=\s*["']([^"']*)["']/i.exec(m)?.[1] ?? "");
  });
  out = out.replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]{64,}/g, () => {
    omitted++;
    return "[embedded data omitted]";
  });
  return { text: out.replace(/\n{3,}/g, "\n\n"), omitted };
}

export function truncate(text: string): { text: string; truncated: number } {
  if (text.length <= MAX_CHARS) return { text, truncated: 0 };
  return { text: `${text.slice(0, MAX_CHARS)}\n\n[truncated by reedright drive sync: ${text.length - MAX_CHARS} characters omitted; open the file in Drive for the rest]`, truncated: text.length - MAX_CHARS };
}

export interface RenderInput {
  file: WalkedFile;
  domain: string;
  handle: string;
  run: string;
  mode: IngestMode;
  content: string | null;
  contentNote?: string;
  created: string;
  syncedAt: string;
}

export function renderRef(input: RenderInput): string {
  const { file, mode } = input;
  const fm: Frontmatter = {
    type: "ref",
    domain: input.domain,
    author: input.handle,
    run: input.run,
    source: file.webViewLink,
    created: input.created,
    review_by: addDays(input.created.slice(0, 10), REF_REVIEW_DAYS),
    approved_by: null,
    approved_at: null,
    approval_ref: null,
    supersedes: null,
    system: "gdrive",
    locator: `https://www.googleapis.com/drive/v3/files/${file.id}`,
  };
  const meta = [
    `- Drive: ${file.webViewLink}`,
    `- Location: ${file.drivePath}`,
    `- Type: ${file.mimeType}${file.size != null ? ` (${file.size} bytes)` : ""}`,
    `- Modified in Drive: ${file.modifiedTime}`,
    `- Ingested: ${input.syncedAt} by reedright Drive sync, ${describeMode(mode)}`,
  ];
  let body: string;
  if (input.content != null) {
    const stripped = stripEmbeddedImages(input.content.replace(/\r\n/g, "\n"));
    if (stripped.omitted) meta.push(`- Images: ${stripped.omitted} embedded image${stripped.omitted === 1 ? "" : "s"} omitted (open the Drive file to see them)`);
    const t = truncate(stripped.text.trim());
    body = t.text || "(the file is empty)";
  } else {
    body = `Content not ingested${input.contentNote ? `: ${input.contentNote}` : ""}. Open the file in Drive.`;
  }
  return serializeEntry(fm, `# ${file.name}\n\n${meta.join("\n")}\n\n---\n\n${body}`);
}

export type SyncAction = "added" | "updated" | "archived" | "unchanged" | "skipped";

export interface SyncEntry {
  fileId: string;
  name: string;
  drivePath: string;
  webViewLink: string;
  path: string;
  action: SyncAction;
  mode: IngestMode;
  note?: string;
}

export interface SyncStats {
  added: number;
  updated: number;
  archived: number;
  unchanged: number;
  skipped: number;
}

export function statsOf(entries: SyncEntry[]): SyncStats {
  const s: SyncStats = { added: 0, updated: 0, archived: 0, unchanged: 0, skipped: 0 };
  for (const e of entries) s[e.action]++;
  return s;
}

export function prTitle(root: { name: string }, domain: string, stats: SyncStats): string {
  const parts = [stats.added && `${stats.added} added`, stats.updated && `${stats.updated} updated`, stats.archived && `${stats.archived} archived`].filter(Boolean);
  return `[ref/${domain}] Drive sync: ${root.name} (${parts.join(", ") || "no changes"})`;
}

export function prBody(input: { root: { name: string; webViewLink: string }; handle: string; run: string; domain: string; entries: SyncEntry[]; truncated: boolean; approvers: string[]; orgSlug: string; appUrl: string; requestId: string }): string {
  const { entries } = input;
  const stats = statsOf(entries);
  const section = (title: string, action: SyncAction) => {
    const rows = entries.filter((e) => e.action === action);
    if (!rows.length) return [];
    return [
      `### ${title} (${rows.length})`,
      "",
      "| document | location | mode | path |",
      "| --- | --- | --- | --- |",
      ...rows.map((e) => `| [${e.name.replace(/\|/g, "\\|")}](${e.webViewLink}) | ${e.drivePath.replace(/\|/g, "\\|")} | ${e.mode}${e.note ? ` (${e.note})` : ""} | \`${e.path}\` |`),
      "",
    ];
  };
  return [
    `Drive sync of **[${input.root.name}](${input.root.webViewLink})** into \`refs/${input.domain}/\`, proposed by **${input.handle}** via reedright.`,
    "",
    `Run: \`${input.run}\`. ${stats.added} added, ${stats.updated} updated, ${stats.archived} archived, ${stats.unchanged} unchanged, ${stats.skipped} skipped.${input.truncated ? ` The walk stopped at the per-run file limit; run the sync again to continue.` : ""}`,
    "",
    ...section("Added", "added"),
    ...section("Updated", "updated"),
    ...section("Archived (no longer in Drive)", "archived"),
    ...section("Skipped", "skipped"),
    `Every ingested document is a \`ref\` pointing back at its Drive file (\`system: gdrive\`, \`locator\` = the Drive API URL). Approve or reject at ${input.appUrl}/orgs/${input.orgSlug}/approvals (request \`${input.requestId}\`). Can approve: ${input.approvers.map((a) => `\`${a}\``).join(", ") || "nobody (fix OWNERS.yaml)"}.`,
  ].join("\n");
}
