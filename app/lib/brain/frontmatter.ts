// Split, parse, and serialize the frontmatter block. Pure.
import YAML from "yaml";
import { FRONTMATTER_KEYS, type Frontmatter } from "./schema";

export interface Split {
  data: Record<string, unknown> | null;
  body: string;
  error?: string;
}

const FENCE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

export function splitFrontmatter(raw: string): Split {
  const m = FENCE.exec(raw);
  if (!m) return { data: null, body: raw, error: "no frontmatter block (expected a leading --- ... --- fence)" };
  let parsed: unknown;
  try {
    parsed = YAML.parse(m[1]);
  } catch (e) {
    return { data: null, body: raw.slice(m[0].length), error: `frontmatter is not valid YAML: ${(e as Error).message}` };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { data: null, body: raw.slice(m[0].length), error: "frontmatter must be a YAML mapping" };
  }
  return { data: parsed as Record<string, unknown>, body: raw.slice(m[0].length).replace(/^(\r?\n)+/, "") };
}

/** Render a file: frontmatter in RFC key order, then a blank line, then the body. */
export function serializeEntry(fm: Frontmatter, body: string): string {
  const ordered: Record<string, unknown> = {};
  for (const k of FRONTMATTER_KEYS) {
    if (k in fm && (fm as Record<string, unknown>)[k] !== undefined) ordered[k] = (fm as Record<string, unknown>)[k];
  }
  const yaml = YAML.stringify(ordered, { lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
}

/** First markdown H1 in the body, or null. */
export function titleOf(body: string): string | null {
  const m = /^#\s+(.+?)\s*$/m.exec(body);
  return m ? m[1].trim() : null;
}

/** Title from a path like observations/marketing/2026-09-15-some-slug.md -> "some slug". */
export function titleFromPath(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-/g, " ");
}
