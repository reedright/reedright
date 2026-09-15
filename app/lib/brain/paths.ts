// Entry paths (RFC §2). Pure.
import { DIR_TYPE, ENTRY_SLUG_RE, TYPE_DIR, type EntryType } from "./schema";

export const ARCHIVE_DIR = "archive";
export const MANIFEST_PATH = "MANIFEST.md";
export const OWNERS_PATH = "OWNERS.yaml";
export const SCHEMA_PATH = "SCHEMA.md";

export function entryPath(type: EntryType, domain: string, created: string, slug: string): string {
  if (!ENTRY_SLUG_RE.test(slug)) throw new Error(`invalid slug "${slug}"`);
  return `${TYPE_DIR[type]}/${domain}/${created}-${slug}.md`;
}

export interface ParsedPath {
  type: EntryType;
  domain: string;
  filename: string;
  archived: boolean;
}

/** `observations/marketing/x.md` or `archive/observations/marketing/x.md` -> parts. Null for anything else. */
export function parseEntryPath(path: string): ParsedPath | null {
  const parts = path.split("/");
  let archived = false;
  if (parts[0] === ARCHIVE_DIR) {
    archived = true;
    parts.shift();
  }
  if (parts.length !== 3) return null;
  const [dir, domain, filename] = parts;
  const type = DIR_TYPE[dir];
  if (!type || !filename.endsWith(".md") || filename === ".gitkeep") return null;
  return { type, domain, filename, archived };
}

export function archivePath(path: string): string {
  return path.startsWith(`${ARCHIVE_DIR}/`) ? path : `${ARCHIVE_DIR}/${path}`;
}

export function isEntryPath(path: string): boolean {
  const p = parseEntryPath(path);
  return Boolean(p && !p.archived);
}
